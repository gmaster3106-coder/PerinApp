import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Memory() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/srs', { replace: true }); }, []);
  return null;
}
