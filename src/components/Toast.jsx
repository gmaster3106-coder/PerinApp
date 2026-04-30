import { useState, useEffect, useRef } from 'react';

let _showToast = null;
export function showToast(msg, duration = 2600) { _showToast?.(msg, duration); }

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    _showToast = (message, duration = 2600) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMsg(message);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), duration);
    };
    return () => { _showToast = null; if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className={`toast${visible ? ' show' : ''}`}>{msg}</div>
  );
}
