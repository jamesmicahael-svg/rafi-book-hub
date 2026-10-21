import { initials } from '../../lib/utils';

export function Avatar({
  url,
  name,
  size = 40,
  onClick,
}: {
  url?: string | null;
  name: string;
  size?: number;
  onClick?: () => void;
}) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  const cls = 'avatar';
  if (url) {
    return (
      <div className={cls} style={style} onClick={onClick} role={onClick ? 'button' : undefined}>
        <img src={url} alt={name} />
      </div>
    );
  }
  return (
    <div className={cls} style={style} onClick={onClick} role={onClick ? 'button' : undefined}>
      {initials(name)}
    </div>
  );
}
