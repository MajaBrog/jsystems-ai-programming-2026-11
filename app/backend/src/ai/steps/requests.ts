import { zodResponseFormat } from 'openai/helpers/zod';
import type { AppConfig } from '../../config/config.ts';
import { buildChatMessages, buildDecisionUserMessage, buildSystemPrompt, buildVisionText } from '../context/contextBuilder.ts';
import { AssessmentProposalSchema, ChatEvaluationSchema, ImageAnalysisSchema } from '../domain/schemas.ts';
import type { CaseForm, ChatContext, ChatEvaluation, ImageAnalysis, IsoDate } from '../domain/types.ts';
import type { PromptRepository } from '../prompt/promptRepository.ts';

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image_url'; image_url: { url: string } };
export type WireMessage =
  | { role: 'system'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'user'; content: string | Array<TextPart | ImagePart> };

/** Chat Completions body as sent to OpenRouter (ADR-002 §5 wire contract). `reasoning` is OpenRouter-specific. */
export type WireRequest = {
  model: string;
  messages: WireMessage[];
  response_format?: ReturnType<typeof zodResponseFormat>;
  reasoning: { effort: 'low' | 'medium' };
  stream?: boolean;
};

type Base = { config: AppConfig; prompts: PromptRepository };

export const imageAnalysisFormat = zodResponseFormat(ImageAnalysisSchema, 'image_analysis');
export const assessmentProposalFormat = zodResponseFormat(AssessmentProposalSchema, 'assessment_proposal');
export const chatEvaluationFormat = zodResponseFormat(ChatEvaluationSchema, 'chat_evaluation');

export function buildVisionRequest(p: Base & { form: CaseForm; jpeg: Buffer }): WireRequest {
  return {
    model: p.config.llmVisionModel,
    messages: [
      { role: 'system', content: p.prompts.systemPrompt('vision', p.form.caseType) },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionText(p.form) },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.jpeg.toString('base64')}` } },
        ],
      },
    ],
    response_format: imageAnalysisFormat,
    reasoning: { effort: 'low' },
  };
}

export function buildDecisionRequest(p: Base & { form: CaseForm; analysis: ImageAnalysis; today: IsoDate }): WireRequest {
  return {
    model: p.config.llmModel,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt({
          instructions: p.prompts.systemPrompt('decision', p.form.caseType),
          policy: p.prompts.policy(p.form.caseType),
          today: p.today,
        }),
      },
      buildDecisionUserMessage(p.form, p.analysis),
    ],
    response_format: assessmentProposalFormat,
    reasoning: { effort: 'medium' },
  };
}

export function buildEvaluateRequest(p: Base & { ctx: ChatContext; customerText: string }): WireRequest {
  return {
    model: p.config.llmModel,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt({
          instructions: p.prompts.systemPrompt('chat-evaluate', p.ctx.form.caseType),
          policy: p.prompts.policy(p.ctx.form.caseType),
          today: p.ctx.today,
        }),
      },
      ...buildChatMessages(p.ctx, p.customerText),
    ],
    response_format: chatEvaluationFormat,
    reasoning: { effort: 'low' },
  };
}

export function buildReplyRequest(p: Base & { ctx: ChatContext; customerText: string; evaluation: ChatEvaluation }): WireRequest {
  return {
    model: p.config.llmModel,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt({
          instructions: p.prompts.systemPrompt('chat-reply', p.ctx.form.caseType),
          policy: p.prompts.policy(p.ctx.form.caseType),
          today: p.ctx.today,
          evaluation: p.evaluation,
        }),
      },
      ...buildChatMessages(p.ctx, p.customerText),
    ],
    reasoning: { effort: 'low' },
    stream: true,
  };
}
