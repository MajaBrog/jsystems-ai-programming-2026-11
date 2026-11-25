# PRD — Hardware Service Decision Copilot

---

## 1. Executive Summary

Hardware Service Decision Copilot is a proof of concept (PoC) of a self-service web application in which an end customer submits a complaint or a return for an electronics device, uploads one photo of the device and receives a **preliminary assessment** (Accept / Reject / Needs review) with a justification based on the company's complaint and return policies. After the assessment the customer can continue in a chat with the agent to ask questions or add information. The final decision is always made by the hardware service team after inspecting the device; the application only prepares and explains the preliminary assessment.

---

## 2. Problem Statement

Customers who want to return or complain about an electronics device do not know whether their case qualifies under the store's rules and the law. They send incomplete requests, ship devices that do not qualify, or wait days for a first answer. Customer support staff repeatedly answer the same questions and assess the same kinds of photos by hand, applying the complaint and return rules inconsistently.

Today the customer has to read the policy documents, guess whether the case qualifies, contact support by email or phone and wait for a human to look at the photo and data before learning anything.

---

## 3. Users / Personas

### 3.1 Anna — customer returning an unused device
- Bought headphones online 6 days ago, changed her mind, device unused, original packaging.
- Wants to know quickly whether she can return it and what to do next.
- Expects a clear yes/no-style answer and concrete next steps (how to ship, what to include).

### 3.2 Marek — customer with a defective device
- Bought a laptop 14 months ago; the screen shows lines after the device was dropped, or alternatively stopped charging with no visible damage.
- Wants to know whether the complaint will be accepted and what happens next.
- Expects an honest explanation of which rule applies (manufacturing defect vs. damage caused by the user) and the option to explain his situation further in the chat.

### 3.3 Service team member (indirect user)
- Does not use the PoC UI. Reads stored sessions (form data, image analysis, assessment, chat history) when the device arrives, to make the final decision.
- Expects every session to be stored completely and to show what the customer was told.

---

## 4. Main Flows

### 4.1 Happy path — return accepted
1. The customer opens the application. The system shows the case form.
2. The customer selects **Return**, a device category, enters the model name, purchase date and (optional for returns) a description, and uploads one photo.
3. The system validates the form on the client side; all required fields are filled and the photo meets the format and size limits.
4. The customer clicks **Submit**. The system shows a progress state ("Analysing photo…", then "Preparing assessment…").
5. The system compresses the photo and sends it to the image-analysis model with the **return** analysis instructions (is the device undamaged, are there signs of use, can it be resold as new).
6. The system passes the image description, form data and the **return policy** document to the decision agent with the **return** decision instructions.
7. The agent returns an assessment: category (Accept / Reject / Needs review), justification referencing the policy rules, and next steps.
8. The system stores the session (form data, photo, image description, assessment) and opens the chat screen.
9. The first chat message from the agent contains: greeting, the preliminary assessment, justification, next steps and the notice that the final decision is made by the service team after inspecting the device.

### 4.2 Happy path — complaint
Same as 4.1 with these differences:
- The customer selects **Complaint**; the description field is required.
- The image analysis uses the **complaint** instructions (is the device damaged, what type of damage, what could have caused it: manufacturing defect, wear, mechanical damage, liquid, other).
- The agent uses the **complaint policy** document and the **complaint** decision instructions.

### 4.3 Chat after the assessment
1. The customer types a message (question or additional information) and sends it.
2. The system stores the message and sends it to the agent together with the full context: form data, image description, first assessment message and all previous chat messages.
3. The agent replies; the reply appears in the chat and is stored.
4. If new information changes the assessment, the agent states explicitly that the preliminary assessment changed, from which category to which, and why (see 4.6).

### 4.4 Photo cannot be assessed
1. The image-analysis model reports that the photo is unusable (blurred, too dark, does not show an electronics device, does not match the selected category).
2. The system does not run the decision agent and does not open the chat.
3. The system returns the customer to the form with all entered values kept (except the photo) and shows a message explaining what is wrong with the photo and how to take a better one.
4. The customer uploads a new photo and submits again.

### 4.5 Ambiguous case — Needs review
1. The agent cannot assign Accept or Reject with confidence (e.g. damage cause unclear, data contradicts the photo, purchase date close to a deadline).
2. The agent returns **Needs review**, lists what is unclear and what the service team will check.
3. The chat opens normally; the customer may add information that could change the assessment.

### 4.6 Assessment revised in the chat
1. The customer provides new information (e.g. "the device was bought in a stationary store, not online", "the scratch was there when I unpacked it").
2. The agent re-evaluates using the same policy and context.
3. If the category changes, the reply starts with a clearly marked notice: "Preliminary assessment changed: [old] → [new]", followed by the justification. The system stores the new assessment as the current one; the previous assessment stays in the history.
4. The agent cannot request or accept a new photo in the chat. If a new photo is needed, it tells the customer to start a new case.

### 4.7 Service error
1. The image-analysis model or the agent does not respond, returns an error or times out.
2. The system shows an error message with a **Try again** button. On the form step, all entered values including the photo are kept. In the chat, the unsent message stays in the input field.
3. No partial assessment is shown.

### 4.8 Session resume
1. The customer reloads the page or opens the session link later in the same browser.
2. The system loads the stored session and shows the chat with the complete history, including the current assessment.

### 4.9 New case
1. On the chat screen the customer clicks **New case**.
2. The system opens an empty form. The previous session stays stored and unchanged.

---

## 5. User Stories

1. As a customer returning an unused device, I want to submit the return with a photo and get a preliminary assessment immediately, so that I know whether to ship the device.
2. As a customer with a damaged device, I want to describe the problem and upload a photo of the damage, so that I learn whether my complaint qualifies and why.
3. As a customer, I want the assessment to explain which rule it is based on and what I should do next, so that I can act without contacting support.
4. As a customer whose photo was rejected as unusable, I want to know what was wrong and keep my form data, so that I only need to retake the photo.
5. As a customer, I want to ask follow-up questions and add information in the chat, so that the assessment reflects my real situation.
6. As a customer whose case is unclear, I want to know that a person will review it and what they will check, so that I am not left with a wrong yes/no answer.
7. As a customer, I want to see a clear error and retry when the service is unavailable, so that I do not lose my data or get a half-finished answer.
8. As a customer, I want to reload the page without losing the conversation, so that I can come back to the case later.
9. As a service team member, I want each session stored with form data, image description, all assessments and chat messages, so that I can see exactly what the customer was told before making the final decision.

---

## 6. Acceptance Criteria

### Form
- AC-01: The form contains: case type (exactly 2 options: Complaint, Return), device category (select from the list in Section 8), model name (text), purchase date (date picker), description (textarea), photo (single file upload).
- AC-02: Case type, category, model name, purchase date and photo are required for both case types. Description is required for Complaint and optional for Return.
- AC-03: The description field label shows a required marker when Complaint is selected and no marker when Return is selected; switching the case type updates the marker without clearing entered values.
- AC-04: A purchase date later than today cannot be selected or submitted; the form shows "Data zakupu nie może być z przyszłości."
- AC-05: Model name accepts 2–100 characters; description accepts up to 2000 characters, with a visible character counter.
- AC-06: Only one photo can be attached; attaching a second one replaces the first. The form shows a thumbnail preview of the attached photo with a remove option.
- AC-07: A file in a format other than JPEG, PNG or WEBP is rejected before upload with "Dozwolone formaty: JPG, PNG, WEBP."
- AC-08: A file larger than 10 MB is rejected before upload with "Plik przekracza limit 10 MB."
- AC-09: Submitting with a missing required field does not send any request and shows an inline error under each missing field.
- AC-10: While a submission is processing, the Submit button is disabled and a progress state is shown; a second submission is not possible.

### Image analysis
- AC-11: The photo is compressed before being sent to the image-analysis model; the original file is not sent to the model.
- AC-12: For Return, the image analysis reports: whether visible damage exists, whether signs of use exist, and whether the device looks resalable as new.
- AC-13: For Complaint, the image analysis reports: whether damage is visible, the damage type, and the likely cause (manufacturing defect, normal wear, mechanical damage, liquid damage, other/unknown).
- AC-14: When the image analysis marks the photo as unusable, no assessment is generated, the form is shown again with all values except the photo kept, and a message names the reason (blurred, too dark, no device visible, device does not match the selected category).

### Assessment (decision agent)
- AC-15: Every assessment has exactly one category: Accept, Reject or Needs review.
- AC-16: Every assessment contains: a justification that names at least one specific rule from the applicable policy document, and at least one concrete next step.
- AC-17: Return cases are assessed only against the return policy; complaint cases only against the complaint policy.
- AC-18: A return with a purchase date more than 14 days before the submission date is assessed as Reject or Needs review, never Accept, and the justification states the 14-day limit.
- AC-19: A return whose image analysis reports visible damage or signs of use is never assessed as Accept.
- AC-20: A complaint with a purchase date more than 2 years before the submission date is assessed as Reject or Needs review, and the justification states the 2-year limit.
- AC-21: A complaint whose image analysis reports mechanical or liquid damage as the likely cause is not assessed as Accept, and the justification explains that damage caused by the user is not covered.
- AC-22: When the image analysis contradicts the form data (e.g. description says "does not turn on", photo shows a cracked casing with no description of an impact), the assessment is Needs review and lists the contradiction.

### Chat
- AC-23: After a successful assessment, the chat screen opens and the first message is from the agent, containing in this order: greeting, assessment category (visually distinguished), justification, next steps, and the notice that this is a preliminary assessment and the final decision belongs to the service team.
- AC-24: The chat shows above the messages a summary of the case: case type, category, model, purchase date and photo thumbnail.
- AC-25: The customer can send text messages of 1–2000 characters; an empty message cannot be sent.
- AC-26: Each agent reply in the chat takes into account the form data, image description, first assessment and all earlier messages (verified by a follow-up question about any of these, e.g. "what date did I enter?", answered correctly).
- AC-27: While the agent is responding, a typing indicator is shown and the send button is disabled.
- AC-28: When the agent changes the assessment category, its reply starts with "Wstępna ocena zmieniona: [old] → [new]" and the case summary shows the new current category.
- AC-29: Agent messages render formatted text (headings, bold, bulleted lists); raw formatting markup is not shown to the customer.

### Errors
- AC-30: When the image analysis or the agent fails or does not respond within 60 seconds, the customer sees "Usługa jest chwilowo niedostępna. Spróbuj ponownie." with a Try again button; on the form step all values including the photo are kept.
- AC-31: When a chat reply fails, the customer's message stays in the input field and can be resent with one click.

### Session
- AC-32: Each submission creates one session storing: form data, the photo, the image-analysis result, every assessment (with timestamp) and every chat message (with author and timestamp).
- AC-33: Reloading the chat page restores the complete chat history and the current assessment.
- AC-34: Each session has its own unique link; opening it shows that session's chat.
- AC-35: The "Nowe zgłoszenie" button opens an empty form and does not modify the previous session.

### General
- AC-36: All UI text and all agent messages are in Polish.
- AC-37: The application works in the latest versions of Chrome, Firefox and Edge on desktop and on mobile screens 360 px wide and up, without horizontal scrolling.

---

## 7. Out of Scope

- **Customer data and purchase history lookup**: the application does not retrieve customer records or verify the purchase; it relies on the data entered in the form.
- **RAG knowledge base**: no searchable knowledge base of electronics specifications or procedures; the agent uses only the two policy documents and the session context.
- **Authentication and customer accounts**: no login; sessions are anonymous and accessed by their link.
- **Service team UI**: no admin panel, dashboard or session list; stored sessions are accessed outside the application.
- **Final decision and case handling**: no shipping labels, RMA numbers, refunds, payments or status tracking.
- **Notifications**: no email, SMS or push messages.
- **Multiple photos, video or new photos in the chat**: exactly one photo per case, uploaded only on the form.
- **Editing a submitted case**: correcting the form requires a new case.
- **Multilingual UI**: Polish only.
- **Native mobile apps**: responsive web only.
- **Integration with ticketing, CRM or ERP systems.**
- **Legal validation of the policy documents**: the example documents are written for the PoC (see Section 12).

---

## 8. Constraints

### Business
- The assessment is always **preliminary**. Every first message and every revised assessment must state that the final decision is made by the service team after receiving and inspecting the device.
- Policy rules follow Polish/EU consumer law as a frame:
  - **Return** (withdrawal from a distance/online purchase): 14 days from receiving the device, no reason required. The customer is responsible for any loss of value caused by using the device beyond what is needed to check it.
  - **Complaint** (seller's liability for non-conformity): the device's non-conformity must appear within 2 years of delivery. Damage caused by the customer (drops, liquid, misuse, unauthorised repair) is not covered.
- Return rules apply to online purchases. When the customer states in the chat that the device was bought in a physical store, the agent must explain that the statutory 14-day return does not apply, and must set the assessment to Reject or Needs review according to the store rules in the return policy.
- The agent must not promise a refund, replacement or repair as a certainty.

### Functional
- Case types: Complaint, Return.
- Device categories: Smartphone; Laptop; Tablet; Desktop computer; Monitor; TV; Headphones / audio; Smartwatch / wearable; Camera; Game console; Printer; Small home appliance; Other.
- Photo: exactly one, JPEG/PNG/WEBP, max 10 MB.
- Text limits: model name 2–100 characters, description and chat message up to 2000 characters.
- Response time: if the image analysis or the agent does not respond within 60 seconds, the request is treated as a failure (AC-30).
- Language: Polish for UI and agent output.
- Browsers: latest Chrome, Firefox and Edge; screen width 360 px and up.

### External document / data references

Two example policy documents must be created as part of the PoC. They are the only rule sources for the agent.

| Document | Location | When it is used |
|---|---|---|
| Return policy (Regulamin zwrotów) | defined in ADR | Every Return case: assessment and chat |
| Complaint policy (Regulamin reklamacji) | defined in ADR | Every Complaint case: assessment and chat |

Minimum content of the **return policy**: 14-day period and how it is counted; condition requirements (no damage, no signs of use beyond checking, complete set, packaging); cases excluded from return (e.g. opened sealed hygiene products such as in-ear headphones, devices with activated or registered accounts not removed); physical store purchases (store goodwill rule, e.g. none, or a stated period); the return procedure (shipping, what to include, refund timing).

Minimum content of the **complaint policy**: 2-year period; what counts as non-conformity (manufacturing defects, failures in normal use); what is excluded (mechanical damage, liquid damage, misuse, normal wear of consumables such as batteries beyond a stated threshold, unauthorised repair); remedies in order (repair or replacement first, then price reduction or refund); the complaint procedure (shipping, description, proof of purchase, response time).

---

## 9. UI Description (wireframe level)

The UI follows the brand reference in `docs/design-guidelines.md`. Layout and behavior are described below; visual details are defined there.

### 9.1 Case form screen
- **Header**: logo, product name "Hardware Service Decision Copilot", one-line explanation ("Sprawdź wstępnie, czy Twoja reklamacja lub zwrot zostaną przyjęte").
- **Case type**: two large selectable options (Reklamacja / Zwrot), one selected at a time. Nothing is preselected.
- **Device category**: dropdown with the list from Section 8.
- **Model name**: text input with placeholder (e.g. "np. Galaxy S24, ThinkPad T14").
- **Purchase date**: date picker; future dates disabled.
- **Description**: textarea with character counter; label and hint change with case type (Complaint: "Opisz usterkę i okoliczności jej powstania" + required marker; Return: "Powód zwrotu (opcjonalnie)").
- **Photo**: drop zone with "Wybierz plik" button, hint depending on case type (Complaint: "Pokaż uszkodzenie"; Return: "Pokaż, że urządzenie nie jest uszkodzone"), and accepted formats and size limit. After attaching: thumbnail, file name, remove button.
- **Submit button** ("Wyślij zgłoszenie").
- **Validation errors**: inline under each field, shown on submit and on leaving a field.
- **Unusable photo state**: alert box above the photo field with the reason and tips (good light, whole device visible, damage in focus); photo field emptied, other values kept.
- **Loading state**: form fields locked, button disabled, progress indicator with step text ("Analizujemy zdjęcie…" → "Przygotowujemy ocenę…").
- **Service error state**: alert with message from AC-30 and "Spróbuj ponownie" button that resubmits the same data.

### 9.2 Chat screen
- **Header**: logo, "Nowe zgłoszenie" button.
- **Case summary panel** (above messages, collapsible on mobile): case type, category, model, purchase date, photo thumbnail (click to enlarge), current assessment badge (Accept / Reject / Needs review, each visually distinct; Polish labels: Przyjęte wstępnie / Odrzucone wstępnie / Wymaga weryfikacji).
- **Message list**: agent messages left-aligned, customer messages right-aligned. The first agent message is formatted with sections: greeting, assessment (badge), "Uzasadnienie", "Następne kroki", preliminary-assessment notice. Messages that change the assessment show the change notice at the top.
- **Input area**: multiline text field with character counter, send button; Enter sends, Shift+Enter adds a new line.
- **Loading state**: typing indicator under the last message; send disabled.
- **Error state**: inline error under the failed message with "Wyślij ponownie"; text kept in the input.
- **Empty state**: not applicable; the chat always starts with the first assessment message.

### 9.3 Session not found
- Shown when a session link does not exist: message "Nie znaleziono zgłoszenia" and a button to start a new case.

### 9.4 Navigation
- Form → (successful submission) → Chat.
- Form → (unusable photo or error) → Form with messages.
- Chat → "Nowe zgłoszenie" → empty Form.
- Session link → Chat, or Session not found.

---

## 10. User Flow Diagram

```mermaid
flowchart TD
    A[Open application] --> B[Case form]
    L[Open session link] --> M{Session exists?}
    M -- No --> N[Session not found] --> B
    M -- Yes --> J
    B --> C{Client validation OK?}
    C -- No --> C1[Inline field errors] --> B
    C -- Yes --> D[Submit: compress photo, image analysis<br/>return or complaint instructions]
    D --> E{Analysis result}
    E -- Service error / timeout --> E1[Error + Try again<br/>all data kept] --> D
    E -- Photo unusable --> E2[Form with reason<br/>photo cleared, data kept] --> B
    E -- Usable --> F[Decision agent<br/>form data + image description + policy]
    F -- Service error / timeout --> E1
    F --> G{Assessment}
    G -- Accept --> H[Store session]
    G -- Reject --> H
    G -- Needs review --> H
    H --> J[Chat: first message<br/>greeting, assessment, justification, next steps, notice]
    J --> K[Customer sends message]
    K --> K1{Agent reply}
    K1 -- Error --> K2[Inline error, message kept] --> K
    K1 -- Same assessment --> J
    K1 -- Assessment changed --> K3[Change notice old → new<br/>store new current assessment] --> J
    J --> P[New case] --> B
```

---

## 11. Agent / System Behavior Specification

### 11.1 Image-analysis step
- **Role**: describe the device's visible condition objectively for the decision agent. It does not make the assessment.
- **Return instructions**: determine whether the photo shows an electronics device matching the selected category; whether any damage is visible; whether signs of use are visible (scratches, dirt, wear, missing protective films, missing parts); whether the device looks resalable as new.
- **Complaint instructions**: determine whether the photo shows an electronics device matching the selected category; whether damage is visible; the damage type (crack, dent, scratch, burn, corrosion, display defect, other); the likely cause (manufacturing defect, normal wear, mechanical damage, liquid damage, other/unknown) with a confidence level (high/medium/low).
- **Usability check (both)**: mark the photo as unusable when it is blurred, too dark, shows no electronics device, or shows a device that clearly does not match the selected category, and give the reason.
- **Not allowed**: guessing details not visible in the photo; stating facts about purchase, warranty or the customer.

### 11.2 Decision agent
- **Role**: preliminary assessment of a return or complaint, and conversation with the customer about that case.
- **Inputs**: form data, image-analysis result, the applicable policy document (return or complaint, never both), the decision instructions for that case type, the submission date and, in the chat, the full conversation history.
- **Decision categories**:
  - **Accept (Przyjęte wstępnie)**: all policy conditions are met based on the data and photo. Communicate the next steps to send the device.
  - **Reject (Odrzucone wstępnie)**: a policy condition is clearly not met (deadline exceeded, damage excluded by the policy, signs of use for a return). Name the rule; say what the customer can still do (e.g. paid repair, contact support).
  - **Needs review (Wymaga weryfikacji)**: the data is insufficient, contradictory or borderline, or the image-analysis confidence is low. List what is unclear and what the service team will check.
- **Allowed**: explain the policy rules applicable to the case; ask the customer for missing information; revise the assessment based on new information in the chat, with the change notice (AC-28); describe next steps from the policy.
- **Not allowed**: making a final or binding decision; promising refunds, replacements, repairs, amounts or deadlines not stated in the policy; applying rules not in the provided policy document; giving general legal advice beyond the policy; asking for or accepting new photos in the chat; asking for personal data (address, phone, ID number, bank account); discussing other customers or cases.
- **Mandatory notice**: the first message and every message that changes the assessment end with: "To jest wstępna ocena. Ostateczną decyzję podejmie zespół serwisowy po otrzymaniu i sprawdzeniu urządzenia."
- **Off-topic requests**: politely decline, say the assistant only handles this complaint or return case, and return to the case.
- **Attempts to change the rules**: if the customer asks the agent to ignore the policy or its instructions, the agent declines and keeps the current assessment.
- **Language and tone**: Polish; formal address ("Pan/Pani" or neutral impersonal forms); short paragraphs and lists; factual, polite, no emojis; no blaming the customer.

---

## 12. Further Notes

### Assumptions
- Photo format and size limits (JPEG/PNG/WEBP, 10 MB), text length limits, the 60-second timeout and the device category list are PoC assumptions chosen during PRD writing; change them here if needed.
- The submission date is used as the reference date for the 14-day and 2-year limits; for returns the delivery date is assumed equal to the purchase date because the form does not collect a delivery date.
- Purchase channel (online vs. physical store) is not a form field; returns are assumed online unless the customer states otherwise in the chat.
- Sessions are accessible to anyone who has the link; this is accepted for the PoC without authentication.
- Retention period of stored sessions and photos is not defined for the PoC.

### Open questions
- Should the purchase channel (online / physical store) and delivery date become form fields after the PoC, to make the return assessment deterministic?
- Should stored photos and sessions be deleted after a fixed period (data protection) before any use with real customers?
- Who reviews sessions marked Needs review, and how do they access them, once the PoC moves beyond demonstration?

### Legal note
The policy documents and the legal frame in Section 8 are simplified examples for the PoC. They must be validated by a legal team before use with real customers.

### Deferred features (candidates for later versions)
- Customer data and purchase history lookup to verify the purchase date and channel.
- RAG knowledge base with device specifications and procedures.
- Service team panel for reviewing sessions and recording the final decision.
