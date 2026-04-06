import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core import config


def send_email(to: str, subject: str, html: str) -> None:
    """
    Send an email via Gmail SMTP (preferred) or Resend fallback.
    Raises RuntimeError if neither is configured.
    """
    if config.MAIL_USERNAME and config.MAIL_PASSWORD:
        _send_via_smtp(to, subject, html)
    elif config.RESEND_API_KEY:
        _send_via_resend(to, subject, html)
    else:
        raise RuntimeError(
            "Email not configured. Set MAIL_USERNAME + MAIL_PASSWORD "
            "(Gmail App Password) or RESEND_API_KEY in env vars."
        )


def _send_via_resend(to: str, subject: str, html: str) -> None:
    import resend
    resend.api_key = config.RESEND_API_KEY
    resend.Emails.send({
        "from": config.MAIL_FROM,
        "to":   [to],
        "subject": subject,
        "html": html,
    })


def send_welcome_email(to: str, username: str) -> None:
    """Send a welcome email after successful registration."""
    display = username or to.split("@")[0]
    html = f"""
    <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:40px 32px;background:#0a0a0a;color:#e5e5e5">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#22c55e;margin:0 0 32px">
        SentimentSignal
      </p>
      <h1 style="font-size:22px;font-weight:900;letter-spacing:0.05em;color:#ffffff;margin:0 0 16px">
        Welcome, {display}.
      </h1>
      <p style="font-size:14px;color:#a3a3a3;line-height:1.6;margin:0 0 28px">
        Your account is live. You now have access to real-time sentiment analysis,
        stock signals, discussion threads, and your personal feed.
      </p>
      <div style="border:1px solid #22c55e22;background:#22c55e0a;padding:20px;margin:0 0 28px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#22c55e;margin:0 0 12px">
          Get started
        </p>
        <ul style="font-size:13px;color:#a3a3a3;margin:0;padding:0 0 0 16px;line-height:2">
          <li>Browse trending stocks on your <strong style="color:#e5e5e5">Feed</strong></li>
          <li>Add stocks to your <strong style="color:#e5e5e5">Watchlist</strong></li>
          <li>Track positions in your <strong style="color:#e5e5e5">Portfolio</strong></li>
          <li>Join the conversation in <strong style="color:#e5e5e5">Discuss</strong></li>
        </ul>
      </div>
      <a href="{config.FRONTEND_URL}/app"
         style="display:inline-block;background:#22c55e;color:#000000;font-size:12px;font-weight:700;
                letter-spacing:0.15em;text-transform:uppercase;padding:12px 24px;text-decoration:none">
        Open SentimentSignal →
      </a>
      <p style="font-size:11px;color:#444;margin:32px 0 0">
        You're receiving this because you created an account at sentimentsignal.vercel.app
      </p>
    </div>
    """
    try:
        send_email(to, "Welcome to SentimentSignal", html)
    except Exception as e:
        print(f"[mail] Welcome email failed (non-fatal): {e}")


def _send_via_smtp(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = config.MAIL_SENDER
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(config.MAIL_SERVER, config.MAIL_PORT) as smtp:
        if config.MAIL_USE_TLS:
            smtp.starttls()
        smtp.login(config.MAIL_USERNAME, config.MAIL_PASSWORD)
        smtp.sendmail(config.MAIL_SENDER, to, msg.as_string())
