/** Read-only Kids Plans row from Connect GET /api/kids-plans (sanitized). */
export type KidsPlan = {
  id: string;
  serviceDate: string;
  classroom: string;
  title: string | null;
  notes: string | null;
  fileName: string | null;
  contentType: string | null;
  signedUrl: string | null;
};

export type KidsPlansErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'invalid'
  | 'network';

export class KidsPlansError extends Error {
  readonly code: KidsPlansErrorCode;

  constructor(code: KidsPlansErrorCode, message: string) {
    super(message);
    this.name = 'KidsPlansError';
    this.code = code;
  }
}
