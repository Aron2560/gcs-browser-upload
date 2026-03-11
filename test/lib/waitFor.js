export default function waitFor(fn, timeout = 30) {
  return new Promise((resolve) => {
    const check = () => {
      if (fn()) {
        resolve();
      } else {
        setTimeout(check, timeout);
      }
    };
    check();
  });
}
