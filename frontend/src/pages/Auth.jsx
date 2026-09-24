import AuthCard from '../components/AuthCard.jsx';

function Auth({ mode, onBack }) {
  return (
    <div className="auth-page">
      <button className="link-button auth-back" onClick={onBack}>&larr; Back to home</button>
      <AuthCard initialMode={mode} />
    </div>
  );
}

export default Auth;
