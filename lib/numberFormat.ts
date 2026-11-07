const NF = new Intl.NumberFormat()

export const fmtNum = (n: number): string => NF.format(n)
