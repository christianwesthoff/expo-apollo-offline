const registerListener = <T>(
  caller: T,
  fnName: keyof T,
  onExecute: () => void
) => {
  const ref = caller[fnName] as any;
  (caller[fnName] as any) = (...args: any[]) => {
    const res = ref.apply(caller, args);
    onExecute();
    return res;
  };

  return () => {
    caller[fnName] = ref;
  };
};

const registerListeners = <T>(
  caller: T,
  fnNames: (keyof T)[],
  onExecute: () => void
) => {
  const refs = fnNames.map((fnName) =>
    registerListener(caller, fnName, onExecute)
  );
  return () => {
    refs.forEach((ref) => ref());
  };
};
