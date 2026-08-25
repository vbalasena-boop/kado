import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'db.json');

export type ProspectStatus = 'pending' | 'contacted' | 'skipped';

export interface Prospect {
  placeId: string;
  name: string;
  /** La requête qui a fait surgir ce commerce, ex: "restaurant Lyon 6". */
  query: string;
  website: string | null;
  email: string | null;
  /** Position (1-based) dans les résultats Google pour cette requête. */
  rank: number;
  rating: number | null;
  reviews: number;
  /** Concurrent le plus fort de la même recherche (le plus d'avis). */
  leaderName: string;
  leaderReviews: number;
  status: ProspectStatus;
  addedAt: string;
}

export interface SentRecord {
  email: string;
  placeId: string;
  name: string;
  subject: string;
  sentAt: string; // ISO
}

interface DbShape {
  prospects: Prospect[];
  sent: SentRecord[];
  suppression: string[]; // e-mails à ne jamais contacter (lowercase)
}

function emptyDb(): DbShape {
  return { prospects: [], sent: [], suppression: [] };
}

function load(): DbShape {
  if (!existsSync(DB_PATH)) return emptyDb();
  try {
    const raw = readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      prospects: parsed.prospects ?? [],
      sent: parsed.sent ?? [],
      suppression: parsed.suppression ?? [],
    };
  } catch {
    console.warn('⚠️  db.json illisible, réinitialisation en mémoire.');
    return emptyDb();
  }
}

function persist(db: DbShape): void {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

export class Db {
  private db: DbShape;
  constructor() {
    this.db = load();
  }

  save(): void {
    persist(this.db);
  }

  get prospects(): Prospect[] {
    return this.db.prospects;
  }

  hasProspect(placeId: string): boolean {
    return this.db.prospects.some((p) => p.placeId === placeId);
  }

  isSuppressed(email: string): boolean {
    return this.db.suppression.includes(email.toLowerCase());
  }

  addSuppression(email: string): void {
    const e = email.toLowerCase();
    if (!this.db.suppression.includes(e)) this.db.suppression.push(e);
  }

  addProspect(p: Prospect): void {
    this.db.prospects.push(p);
  }

  /** Combien de mails envoyés aujourd'hui (jour local). */
  sentToday(): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.db.sent.filter((s) => s.sentAt.slice(0, 10) === today).length;
  }

  alreadyEmailed(email: string): boolean {
    const e = email.toLowerCase();
    return this.db.sent.some((s) => s.email.toLowerCase() === e);
  }

  recordSent(rec: SentRecord): void {
    this.db.sent.push(rec);
  }

  markStatus(placeId: string, status: ProspectStatus): void {
    const p = this.db.prospects.find((x) => x.placeId === placeId);
    if (p) p.status = status;
  }

  stats() {
    const byStatus = { pending: 0, contacted: 0, skipped: 0 } as Record<
      ProspectStatus,
      number
    >;
    for (const p of this.db.prospects) byStatus[p.status]++;
    return {
      total: this.db.prospects.length,
      withEmail: this.db.prospects.filter((p) => p.email).length,
      ...byStatus,
      sentTotal: this.db.sent.length,
      sentToday: this.sentToday(),
      suppressed: this.db.suppression.length,
    };
  }
}
