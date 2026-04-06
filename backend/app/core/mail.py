import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core import config


def send_email(to: str, subject: str, html: str) -> None:
    """
    Send an email via Resend (preferred) or SMTP fallback.
    Raises RuntimeError if neither is configured.
    """
    if config.RESEND_API_KEY:
        _send_via_resend(to, subject, html)
    elif config.MAIL_USERNAME and config.MAIL_PASSWORD:
        _send_via_smtp(to, subject, html)
    else:
        raise RuntimeError(
            "Email not configured. Set RESEND_API_KEY (preferred) or "
            "MAIL_USERNAME + MAIL_PASSWORD in .env"
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
