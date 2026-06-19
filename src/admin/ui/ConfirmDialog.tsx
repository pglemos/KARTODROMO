import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export const ConfirmDialog = ({
  isOpen,
  loading = false,
  message,
  onClose,
  onConfirm,
  title,
}: ConfirmDialogProps) => (
  <Modal
    footer={
      <>
        <Button disabled={loading} onClick={onClose} variant="ghost">
          Cancelar
        </Button>
        <Button loading={loading} onClick={onConfirm} variant="danger">
          Excluir
        </Button>
      </>
    }
    isOpen={isOpen}
    onClose={loading ? () => undefined : onClose}
    title={title}
  >
    <p className="text-sm leading-6 text-zinc-200">{message}</p>
  </Modal>
);
