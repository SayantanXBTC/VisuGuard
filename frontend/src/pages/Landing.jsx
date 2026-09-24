import { APP_NAME } from '../config.js';

const steps = [
  { number: '01', title: 'CAPTURE', text: 'Capture your approved website as a baseline.' },
  { number: '02', title: 'COMPARE', text: 'Capture a newer deployment and compare it against the baseline.' },
  { number: '03', title: 'ANALYZE', text: 'Detect visual differences using automated image comparison.' },
  { number: '04', title: 'REPORT', text: 'View page-by-page differences and generate a report.' },
];

function Landing({ loggedIn, notice, onGetStarted, onSignIn, onGoDashboard }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="brand">{APP_NAME}</span>
        {loggedIn ? (
          <button className="btn btn-primary" onClick={onGoDashboard}>Go to Dashboard</button>
        ) : (
          <button className="btn btn-ghost" onClick={onSignIn}>Sign In</button>
        )}
      </header>

      {notice && <p className="banner banner-success landing-notice">{notice}</p>}

      <section className="hero">
        <h1>Catch visual regressions before your users do.</h1>
        <p className="hero-subtitle">Automated visual regression testing for modern web applications.</p>
        <p className="hero-lines">
          Capture an approved baseline.
          <br />
          Compare it with a new deployment.
          <br />
          See exactly what changed.
        </p>
        <div className="hero-actions">
          {loggedIn ? (
            <button className="btn btn-primary btn-large" onClick={onGoDashboard}>Go to Dashboard</button>
          ) : (
            <>
              <button className="btn btn-primary btn-large" onClick={onGetStarted}>Get Started</button>
              <button className="btn btn-outline btn-large" onClick={onSignIn}>Sign In</button>
            </>
          )}
        </div>
      </section>

      <section className="how-it-works">
        <h2>How it works</h2>
        <div className="steps">
          {steps.map((step) => (
            <div className="step" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">{APP_NAME} is a hackathon project.</footer>
    </div>
  );
}

export default Landing;
