declare module 'mendeleev' {
  interface Element {
    symbol: string;
    number: number;
    name?: string;
    mass?: number;
    radius_bond?: number;
  }

  class PeriodicTable {
    static getElement(symbol: string): Element | null;
    static getAtomic(atomicNumber: number): Element | null;
    static getGroup(group: number): Element[] | null;
  }

  interface MendeleevModule {
    PeriodicTable: typeof PeriodicTable;
  }

  const m: MendeleevModule;
  export default m;
}
