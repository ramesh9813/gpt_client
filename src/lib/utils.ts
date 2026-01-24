export const cn = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(" ");