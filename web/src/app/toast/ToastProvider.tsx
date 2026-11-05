import { hideToast } from "@app/toast/toast.slice";
import type { AppState } from "@app/store";
import { ITToast } from "@axzydev/axzy_ui_system";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";

interface ToastProviderProps {
  children: React.ReactNode;
}

const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const { message, type, duration, position, isVisible } = useSelector(
    (state: AppState) => state.toast
  );

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        dispatch(hideToast());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, message, dispatch]);

  return (
    <>
      {children}
      {isVisible &&
        createPortal(
          <div className="fixed inset-0 z-[99999] pointer-events-none">
            <ITToast
              message={message}
              type={type}
              duration={duration}
              position={position}
              onClose={() => dispatch(hideToast())}
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default ToastProvider;