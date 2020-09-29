export const registerListener = <T>(
  caller: T,
  fnName: keyof T,
  trigger: () => void
) => {
  const ref = caller[fnName] as any;
  caller[fnName] = ((...args: any[]) => {
    const res = ref.apply(caller, args);
    trigger();
    return res;
  }) as any;

  return () => {
    caller[fnName] = ref;
  };
};

export const registerListeners = <T>(
  caller: T,
  fnNames: (keyof T)[],
  trigger: () => void
) => {
  const unrefs = fnNames.map((fnName) =>
    registerListener(caller, fnName, trigger)
  );
  return () => {
    unrefs.forEach((unref) => unref());
  };
};
