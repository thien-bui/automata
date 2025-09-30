import { inject, provide, ref, type Ref } from 'vue';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
  timeout?: number;
}

interface ToastContext {
  messages: Ref<ToastMessage[]>;
  push: (message: string | Omit<ToastMessage, 'id'>) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

const ToastSymbol = Symbol('toast-context');

let idCounter = 0;

function buildMessage(input: string | Omit<ToastMessage, 'id'>): ToastMessage {
  if (typeof input === 'string') {
    return {
      id: Date.now() + idCounter++,
      text: input,
      variant: 'info',
      timeout: 5000,
    };
  }

  const { variant = 'info', timeout = 5000, ...rest } = input;

  return {
    id: Date.now() + idCounter++,
    variant,
    timeout,
    ...rest,
  };
}

export function provideToasts(initialMessages: Array<string | Omit<ToastMessage, 'id'>> = []) {
  const messages = ref<ToastMessage[]>(initialMessages.map((message) => buildMessage(message)));

  const context: ToastContext = {
    messages,
    push: (input) => {
      const message = buildMessage(input);
      messages.value = [...messages.value, message];
      return message.id;
    },
    dismiss: (id) => {
      messages.value = messages.value.filter((message) => message.id !== id);
    },
    clear: () => {
      messages.value = [];
    },
  };

  provide(ToastSymbol, context);

  return context;
}

export function useToasts(): ToastContext {
  const context = inject<ToastContext | undefined>(ToastSymbol);

  if (!context) {
    throw new Error('useToasts must be used within a provider.');
  }

  return context;
}
