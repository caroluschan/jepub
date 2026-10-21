interface SpinnerProps {
  large?: boolean;
  label?: string;
}

export function Spinner({ large = false, label }: SpinnerProps) {
  return (
    <span
      className={large ? 'spinner spinner--large' : 'spinner'}
      role={label === undefined ? undefined : 'status'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    />
  );
}
