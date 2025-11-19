import { Button, type ButtonProps } from './button';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  loading,
  loadingText = 'Đang xử lý...',
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button {...props}>
      {loading ? loadingText : children}
    </Button>
  );
}
