// What the passenger has done so far, kept in this browser only.
const KEY = 'tepian-musi:v1';

export interface Saved {
  name: string;
  done: boolean[];
  sound: boolean;
}

const blank = (): Saved => ({ name: '', done: [false, false, false, false, false], sound: false });

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const v = JSON.parse(raw) as Partial<Saved>;
    const b = blank();
    return {
      name: typeof v.name === 'string' ? v.name.slice(0, 24) : b.name,
      done: Array.isArray(v.done) ? b.done.map((_, i) => v.done?.[i] === true) : b.done,
      sound: v.sound === true,
    };
  } catch {
    return blank();
  }
}

type Listener = (s: Saved) => void;

class Progress {
  private s: Saved = read();
  private listeners = new Set<Listener>();

  get state(): Readonly<Saved> {
    return this.s;
  }

  get count() {
    return this.s.done.filter(Boolean).length;
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    fn(this.s);
    return () => this.listeners.delete(fn);
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      /* private mode: progress lives for this visit only */
    }
    for (const fn of this.listeners) fn(this.s);
  }

  setName(name: string) {
    this.s = { ...this.s, name: name.trim().slice(0, 24) };
    this.save();
  }

  complete(i: number) {
    if (this.s.done[i]) return false;
    const done = [...this.s.done];
    done[i] = true;
    this.s = { ...this.s, done };
    this.save();
    return true;
  }

  setSound(on: boolean) {
    this.s = { ...this.s, sound: on };
    this.save();
  }

  reset() {
    this.s = { ...blank(), name: this.s.name, sound: this.s.sound };
    this.save();
  }
}

export const progress = new Progress();
