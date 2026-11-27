import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { CaseType, Category } from './types.ts';

export type CaseRecord = {
  id: string;
  caseType: CaseType;
  deviceCategory: string;
  modelName: string;
  purchaseDate: string;
  description: string | null;
  photoPath: string;
  /** Parsed `image_analysis_json` (ADR-002 §3.3 ImageAnalysis). */
  imageAnalysis: unknown;
  currentCategory: Category;
  visionModel: string;
  decisionModel: string;
  createdAt: string;
};

export type CaseRepository = {
  insert(record: CaseRecord): void;
  findById(id: string): CaseRecord | undefined;
  /** Returns the number of rows updated (must be 1 for an existing case). */
  updateCurrentCategory(id: string, category: Category): number;
};

function toCase(row: Record<string, SQLOutputValue>): CaseRecord {
  return {
    id: row.id as string,
    caseType: row.case_type as CaseType,
    deviceCategory: row.device_category as string,
    modelName: row.model_name as string,
    purchaseDate: row.purchase_date as string,
    description: row.description as string | null,
    photoPath: row.photo_path as string,
    imageAnalysis: JSON.parse(row.image_analysis_json as string),
    currentCategory: row.current_category as Category,
    visionModel: row.vision_model as string,
    decisionModel: row.decision_model as string,
    createdAt: row.created_at as string,
  };
}

export function createCaseRepository(db: DatabaseSync): CaseRepository {
  const insert = db.prepare(
    `INSERT INTO cases (id, case_type, device_category, model_name, purchase_date, description, photo_path,
       image_analysis_json, current_category, vision_model, decision_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const findById = db.prepare('SELECT * FROM cases WHERE id = ?');
  const update = db.prepare('UPDATE cases SET current_category = ? WHERE id = ?');
  return {
    insert(r) {
      insert.run(
        r.id, r.caseType, r.deviceCategory, r.modelName, r.purchaseDate, r.description, r.photoPath,
        JSON.stringify(r.imageAnalysis), r.currentCategory, r.visionModel, r.decisionModel, r.createdAt,
      );
    },
    findById(id) {
      const row = findById.get(id);
      return row ? toCase(row) : undefined;
    },
    updateCurrentCategory(id, category) {
      return Number(update.run(category, id).changes);
    },
  };
}
