"""Outbound email.

Three transports, chosen by `Config.email_provider()`:
  * brevo  - HTTPS API (port 443). Works on hosts that block SMTP.
  * resend - HTTPS API (port 443). Works on hosts that block SMTP.
  * smtp   - classic SMTP (ports 587/465). Blocked on Render free web services.

Nothing here ever reports success unless the provider accepted the message.
With no provider configured every send fails with an explanatory error.
"""
import base64
import json
import logging
import smtplib
import ssl
import urllib.error
import urllib.request
from datetime import datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape

from config import Config
from services.calendar_service import generate_google_calendar_url, generate_ics_content

logger = logging.getLogger(__name__)

NOT_CONFIGURED_ERROR = (
    'Email is not configured on the server. Set BREVO_API_KEY or RESEND_API_KEY '
    '(recommended on Render), or SMTP_USER and SMTP_PASSWORD.'
)


def build_meeting_html_email(
    recipient_name: str,
    is_host: bool,
    meeting_title: str,
    meeting_description: str,
    date_str: str,
    start_time_str: str,
    end_time_str: str,
    meeting_link: str,
    gcal_url: str,
    host_name: str,
    host_email: str,
    guest_emails: list,
    meeting_code: str = ''
) -> str:
    """HTML body for invitations and reminders. All user-supplied text is escaped."""
    recipient_name = escape(recipient_name or '')
    meeting_title = escape(meeting_title or 'VIT Connect meeting')
    meeting_description = escape(meeting_description or '')
    host_name = escape(host_name or 'The host')
    host_email = escape(host_email or '')
    meeting_code = escape(meeting_code or '')
    link_attr = escape(meeting_link, quote=True)
    gcal_attr = escape(gcal_url or '', quote=True)

    role_badge = 'Meeting Host (You)' if is_host else f'Invited by {host_name}'
    intro_message = (
        'Your meeting is set up. The details and joining link are below.'
        if is_host else
        f'<strong>{host_name}</strong> ({host_email}) has invited you to a VIT Connect video meeting.'
    )

    when_row = ''
    if date_str:
        when_row = f"""
                <tr>
                  <td style="padding:6px 0;">
                    <div style="font-size:12px; font-weight:600; color:#70757a; text-transform:uppercase; letter-spacing:0.5px;">Date &amp; Time</div>
                    <div style="font-size:16px; font-weight:600; color:#1a73e8; margin-top:2px;">{escape(date_str)} &nbsp;&bull;&nbsp; {escape(start_time_str or '')} - {escape(end_time_str or '')}</div>
                  </td>
                </tr>"""

    description_row = ''
    if meeting_description:
        description_row = f"""
                <tr><td style="padding:10px 0 6px 0; border-top:1px solid #e8eaed;">
                  <div style="font-size:12px; font-weight:600; color:#70757a; text-transform:uppercase; letter-spacing:0.5px;">Agenda / Notes</div>
                  <div style="font-size:14px; color:#3c4043; margin-top:2px;">{meeting_description}</div>
                </td></tr>"""

    guests_row = ''
    if guest_emails:
        badges = ''.join(
            f"<span style='display:inline-block; background-color:#e8f0fe; color:#1a73e8; padding:3px 8px; border-radius:12px; font-size:12px; margin:2px;'>{escape(g)}</span>"
            for g in guest_emails
        )
        guests_row = f"""
                <tr><td style="padding:10px 0 0 0; border-top:1px solid #e8eaed;">
                  <div style="font-size:12px; font-weight:600; color:#5f6368; text-transform:uppercase; letter-spacing:0.5px;">Guests</div>
                  <div style="margin-top:4px;">{badges}</div>
                </td></tr>"""

    gcal_button = ''
    if gcal_url:
        gcal_button = f"""
                <tr>
                  <td align="center">
                    <a href="{gcal_attr}" target="_blank" style="display:inline-block; background-color:#ffffff; border:1px solid #dadce0; color:#3c4043; font-weight:600; font-size:13px; text-decoration:none; padding:10px 20px; border-radius:8px;">Add to Google Calendar</a>
                  </td>
                </tr>"""

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{meeting_title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f9fa; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#202124;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa; padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #dadce0;" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background-color:#1a73e8; padding:28px 32px; color:#ffffff;">
              <div style="font-size:22px; font-weight:700; color:#ffffff; margin-bottom:12px;">VIT Connect</div>
              <h1 style="margin:0; font-size:24px; font-weight:600; line-height:1.3; color:#ffffff;">{meeting_title}</h1>
              <div style="margin-top:6px; font-size:13px; color:#ffffff;">{role_badge}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:15px; line-height:1.5; color:#3c4043; margin-top:0; margin-bottom:20px;">
                Hello <strong>{recipient_name}</strong>,<br>
                {intro_message}
              </p>
              <table width="100%" style="background-color:#f8f9fa; border:1px solid #e8eaed; border-radius:12px; padding:18px; margin-bottom:24px;" border="0" cellspacing="0" cellpadding="0">
                {when_row}
                {description_row}
                <tr>
                  <td style="padding:10px 0 0 0; border-top:1px solid #e8eaed;">
                    <div style="font-size:12px; font-weight:600; color:#70757a; text-transform:uppercase; letter-spacing:0.5px;">Host</div>
                    <div style="font-size:14px; color:#3c4043; margin-top:2px;">{host_name} ({host_email})</div>
                  </td>
                </tr>
                {guests_row}
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="{link_attr}" target="_blank" style="display:inline-block; background-color:#1a73e8; color:#ffffff; font-weight:600; font-size:15px; text-decoration:none; padding:14px 32px; border-radius:10px;">Join the meeting</a>
                  </td>
                </tr>
                {gcal_button}
              </table>
              <div style="background-color:#f1f3f4; border-radius:8px; padding:12px 16px; font-size:13px; color:#5f6368; word-break:break-all;">
                <strong>How to join</strong><br>
                1. Open <a href="{link_attr}" style="color:#1a73e8;">{escape(meeting_link)}</a><br>
                2. Sign in or create a free VIT Connect account.<br>
                3. Check your camera and microphone, then press "Join now".<br>
                {f'Meeting code: <strong>{meeting_code}</strong>' if meeting_code else ''}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fa; border-top:1px solid #dadce0; padding:20px 32px; text-align:center; font-size:12px; color:#70757a;">
              Sent by VIT Connect on behalf of {host_name}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def build_meeting_text_email(recipient_name, is_host, meeting_title, date_str, start_time_str,
                             end_time_str, meeting_link, host_name, host_email, meeting_code=''):
    lines = [f'Hello {recipient_name},', '']
    if is_host:
        lines.append(f'Your meeting "{meeting_title}" is set up.')
    else:
        lines.append(f'{host_name} ({host_email}) has invited you to the VIT Connect meeting "{meeting_title}".')
    if date_str:
        lines.append(f'When: {date_str} {start_time_str or ""} - {end_time_str or ""}'.rstrip(' -'))
    lines += [
        '',
        f'Join: {meeting_link}',
    ]
    if meeting_code:
        lines.append(f'Meeting code: {meeting_code}')
    lines += [
        '',
        'How to join: open the link, sign in or create a free VIT Connect account, '
        'check your camera and microphone, then press "Join now".',
    ]
    return '\n'.join(lines)


# ----------------------------------------------------------------------
# Transports
# ----------------------------------------------------------------------
def _result(recipient, provider, success, error=None, message_id=None):
    return {
        'success': success,
        'provider': provider,
        'recipient': recipient,
        'error': error,
        'message_id': message_id,
    }


def _http_post_json(url, headers, payload):
    body = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(url, data=body, method='POST', headers={
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'vit-connect-mailer/1.0',
        **headers,
    })
    try:
        with urllib.request.urlopen(request, timeout=Config.EMAIL_TIMEOUT_SECONDS) as response:
            raw = response.read().decode('utf-8', errors='replace')
            return response.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode('utf-8', errors='replace')
        try:
            return exc.code, json.loads(raw)
        except ValueError:
            return exc.code, {'message': raw[:300]}


def _send_brevo(message):
    payload = {
        'sender': {'name': Config.EMAIL_FROM_NAME, 'email': Config.EMAIL_FROM},
        'to': [{'email': message['to']}],
        'subject': message['subject'],
        'htmlContent': message['html'],
        'textContent': message['text'],
    }
    if message.get('ics'):
        payload['attachment'] = [{
            'name': message.get('ics_filename', 'invite.ics'),
            'content': base64.b64encode(message['ics'].encode('utf-8')).decode('ascii'),
        }]
    status, data = _http_post_json('https://api.brevo.com/v3/smtp/email',
                                   {'api-key': Config.BREVO_API_KEY}, payload)
    if 200 <= status < 300:
        return _result(message['to'], 'brevo', True, message_id=data.get('messageId'))
    return _result(message['to'], 'brevo', False,
                   error=f"Brevo rejected the message (HTTP {status}): {data.get('message') or data}")


def _send_resend(message):
    payload = {
        'from': formataddr((Config.EMAIL_FROM_NAME, Config.EMAIL_FROM)),
        'to': [message['to']],
        'subject': message['subject'],
        'html': message['html'],
        'text': message['text'],
    }
    if message.get('ics'):
        payload['attachments'] = [{
            'filename': message.get('ics_filename', 'invite.ics'),
            'content': base64.b64encode(message['ics'].encode('utf-8')).decode('ascii'),
        }]
    status, data = _http_post_json('https://api.resend.com/emails',
                                   {'Authorization': f'Bearer {Config.RESEND_API_KEY}'}, payload)
    if 200 <= status < 300:
        return _result(message['to'], 'resend', True, message_id=data.get('id'))
    return _result(message['to'], 'resend', False,
                   error=f"Resend rejected the message (HTTP {status}): {data.get('message') or data}")


def _build_mime(message):
    msg = MIMEMultipart('mixed')
    msg['Subject'] = message['subject']
    msg['From'] = formataddr((Config.EMAIL_FROM_NAME, Config.EMAIL_FROM))
    msg['To'] = message['to']

    alternative = MIMEMultipart('alternative')
    alternative.attach(MIMEText(message['text'], 'plain', 'utf-8'))
    alternative.attach(MIMEText(message['html'], 'html', 'utf-8'))
    msg.attach(alternative)

    if message.get('ics'):
        filename = message.get('ics_filename', 'invite.ics')
        part = MIMEBase('text', 'calendar', method='REQUEST', name=filename)
        part.set_payload(message['ics'].encode('utf-8'))
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
        msg.attach(part)
    return msg


def _describe_smtp_error(exc):
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return ('SMTP login was rejected. For Gmail, SMTP_PASSWORD must be a 16-character App Password '
                '(2-Step Verification required), not the account password.')
    if isinstance(exc, (TimeoutError, OSError)) and not isinstance(exc, smtplib.SMTPException):
        return (f'Could not reach {Config.SMTP_SERVER}:{Config.SMTP_PORT} ({exc}). The host is blocking outbound '
                'SMTP (Render free web services block ports 25/465/587). Use BREVO_API_KEY or RESEND_API_KEY instead.')
    return f'SMTP error: {exc}'


def _send_smtp_batch(messages):
    """One SMTP session for the whole batch; a connection failure fails the batch once
    instead of timing out separately for every recipient."""
    try:
        if Config.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(Config.SMTP_SERVER, Config.SMTP_PORT,
                                      timeout=Config.EMAIL_TIMEOUT_SECONDS, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(Config.SMTP_SERVER, Config.SMTP_PORT, timeout=Config.EMAIL_TIMEOUT_SECONDS)
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
    except Exception as exc:
        error = _describe_smtp_error(exc)
        logger.error('SMTP connection failed: %s', error)
        return [_result(m['to'], 'smtp', False, error=error) for m in messages]

    results = []
    try:
        for message in messages:
            try:
                refused = server.sendmail(Config.EMAIL_FROM or Config.SMTP_USER, [message['to']],
                                          _build_mime(message).as_string())
                if refused:
                    results.append(_result(message['to'], 'smtp', False, error=f'Recipient refused: {refused}'))
                else:
                    results.append(_result(message['to'], 'smtp', True))
            except Exception as exc:
                results.append(_result(message['to'], 'smtp', False, error=_describe_smtp_error(exc)))
    finally:
        try:
            server.quit()
        except Exception:
            pass
    return results


def send_emails(messages):
    """Send a batch. Each message: {to, subject, html, text, ics?, ics_filename?}.
    Returns one result dict per message, in order."""
    if not messages:
        return []
    provider = Config.email_provider()
    if provider is None:
        logger.error('Email requested but no provider is configured')
        return [_result(m['to'], None, False, error=NOT_CONFIGURED_ERROR) for m in messages]
    if not Config.EMAIL_FROM:
        return [_result(m['to'], provider, False,
                        error='EMAIL_FROM is not set (the verified sender address for the email provider).')
                for m in messages]

    if provider == 'smtp':
        results = _send_smtp_batch(messages)
    else:
        sender = _send_brevo if provider == 'brevo' else _send_resend
        results = []
        for message in messages:
            try:
                results.append(sender(message))
            except Exception as exc:
                results.append(_result(message['to'], provider, False,
                                       error=f'Could not reach the {provider} API: {exc}'))
    for item in results:
        if item['success']:
            logger.info('Email accepted by %s for %s', item['provider'], item['recipient'])
        else:
            logger.error('Email to %s failed: %s', item['recipient'], item['error'])
    return results


def send_email_message(to_email, subject, html_content, ics_content=None, ics_filename='invite.ics',
                       text_content=None):
    """Send one email. Kept for backward compatibility with older callers."""
    return send_emails([{
        'to': to_email,
        'subject': subject,
        'html': html_content,
        'text': text_content or subject,
        'ics': ics_content,
        'ics_filename': ics_filename,
    }])[0]


def summarize(results, targets=None):
    delivered = sum(1 for r in results if r['success'])
    return {
        'provider': next((r['provider'] for r in results if r['provider']), None),
        'attempted': len(results),
        'delivered': delivered,
        'failed': len(results) - delivered,
        'results': [
            {
                'email': r['recipient'],
                'target': (targets or {}).get(r['recipient'], 'guest'),
                'success': r['success'],
                'error': r['error'],
            }
            for r in results
        ],
    }


def meeting_link_for(meeting):
    return f"{Config.FRONTEND_URL.rstrip('/')}/conference/{meeting.meeting_code or meeting.id}"


def send_meeting_invitations(meeting, host_user, recipient_emails, include_host=False,
                             start_dt: datetime = None, end_dt: datetime = None,
                             date_str='', start_time_str='', end_time_str=''):
    """Email the host (optional) and each recipient once. Returns summarize() output
    plus the links used."""
    meeting_link = meeting_link_for(meeting)
    description = meeting.description or f'VIT Connect video meeting hosted by {host_user.name}'
    gcal_url = ''
    ics_content = None
    if start_dt and end_dt:
        gcal_url = generate_google_calendar_url(
            title=meeting.title, description=description, start_dt=start_dt, end_dt=end_dt,
            meeting_link=meeting_link, guest_emails=recipient_emails)
        ics_content = generate_ics_content(
            meeting_id=meeting.id, title=meeting.title, description=description,
            start_dt=start_dt, end_dt=end_dt, meeting_link=meeting_link,
            organizer_name=host_user.name, organizer_email=host_user.email, guest_emails=recipient_emails)

    host_email = host_user.email.lower()
    seen = set()
    recipients = []
    if include_host:
        recipients.append((host_user.email, True))
        seen.add(host_email)
    for email in recipient_emails:
        clean = (email or '').strip()
        if clean and clean.lower() not in seen and clean.lower() != host_email:
            seen.add(clean.lower())
            recipients.append((clean, False))

    messages, targets = [], {}
    for email, is_host in recipients:
        name = host_user.name if is_host else email.split('@')[0]
        common = dict(
            recipient_name=name, is_host=is_host, meeting_title=meeting.title,
            date_str=date_str, start_time_str=start_time_str, end_time_str=end_time_str,
            meeting_link=meeting_link, host_name=host_user.name, host_email=host_user.email,
            meeting_code=meeting.meeting_code or '')
        messages.append({
            'to': email,
            'subject': (f'Meeting scheduled: {meeting.title}' if is_host
                        else f'{host_user.name} invited you to "{meeting.title}" on VIT Connect'),
            'html': build_meeting_html_email(
                meeting_description=meeting.description or '', gcal_url=gcal_url,
                guest_emails=recipient_emails, **common),
            'text': build_meeting_text_email(**common),
            'ics': ics_content,
            'ics_filename': f"{meeting.meeting_code or 'meeting'}.ics",
        })
        targets[email] = 'host' if is_host else 'guest'

    summary = summarize(send_emails(messages), targets)
    summary['meeting_link'] = meeting_link
    summary['google_calendar_url'] = gcal_url
    return summary


def send_meeting_schedule_notifications(meeting, host_user, guest_emails, start_dt, end_dt,
                                        date_str, start_time_str, end_time_str):
    """Scheduling flow: confirmation to the host plus an invitation to every guest."""
    return send_meeting_invitations(
        meeting, host_user, guest_emails, include_host=True,
        start_dt=start_dt, end_dt=end_dt, date_str=date_str,
        start_time_str=start_time_str, end_time_str=end_time_str)
