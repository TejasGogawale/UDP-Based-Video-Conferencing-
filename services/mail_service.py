import smtplib
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from config import Config
from services.calendar_service import generate_google_calendar_url, generate_ics_content

logger = logging.getLogger(__name__)

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
    guest_emails: list
) -> str:
    """Build modern HTML email for meeting invitations and reminders."""
    role_badge = "Meeting Host (You)" if is_host else f"Invited by {host_name}"
    intro_message = (
        f"You have successfully scheduled the following meeting. A reminder and calendar invite have been generated for you and your guests."
        if is_host else
        f"<strong>{host_name}</strong> ({host_email}) has invited you to a VIT Connect video conference."
    )
    
    guests_html = ""
    if guest_emails:
        guests_badges = "".join([
            f"<span style='display:inline-block; background-color:#e8f0fe; color:#1a73e8; padding:3px 8px; border-radius:12px; font-size:12px; margin:2px;'>{g}</span>"
            for g in guest_emails
        ])
        guests_html = f"""
        <div style="margin-top:12px;">
            <div style="font-size:12px; font-weight:600; color:#5f6368; text-transform:uppercase; letter-spacing:0.5px;">Participants / Guests</div>
            <div style="margin-top:4px;">{guests_badges}</div>
        </div>
        """

    html = f"""
<!DOCTYPE html>
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
        <table width="100%" max-width="600" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.06); border:1px solid #dadce0;" border="0" cellspacing="0" cellpadding="0">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%); padding:28px 32px; color:#ffffff;">
              <div style="display:flex; align-items:center; margin-bottom:12px;">
                <span style="font-size:22px; font-weight:700; letter-spacing:-0.5px; color:#ffffff;">VIT <span style="font-weight:300; opacity:0.95;">Connect</span></span>
                <span style="display:inline-block; margin-left:8px; background-color:rgba(255,255,255,0.25); color:#ffffff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;">MEET</span>
              </div>
              <h1 style="margin:0; font-size:24px; font-weight:600; line-height:1.3; color:#ffffff;">{meeting_title}</h1>
              <div style="margin-top:6px; font-size:13px; opacity:0.9; color:#ffffff;">{role_badge}</div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px;">
              <p style="font-size:15px; line-height:1.5; color:#3c4043; margin-top:0; margin-bottom:20px;">
                Hello <strong>{recipient_name}</strong>,<br>
                {intro_message}
              </p>

              <!-- Meeting Details Card -->
              <table width="100%" style="background-color:#f8f9fa; border:1px solid #e8eaed; border-radius:12px; padding:18px; margin-bottom:24px;" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:6px 0;">
                    <div style="font-size:12px; font-weight:600; color:#70757a; text-transform:uppercase; letter-spacing:0.5px;">Date & Time</div>
                    <div style="font-size:16px; font-weight:600; color:#1a73e8; margin-top:2px;">
                      📅 {date_str} &nbsp;•&nbsp; ⏰ {start_time_str} - {end_time_str}
                    </div>
                  </td>
                </tr>

                {f'<tr><td style="padding:10px 0 6px 0; border-top:1px solid #e8eaed;"><div style="font-size:12px; font-weight:600; color:#70757a; text-transform:uppercase; letter-spacing:0.5px;">Agenda / Notes</div><div style="font-size:14px; color:#3c4043; margin-top:2px;">{meeting_description}</div></td></tr>' if meeting_description else ''}

                <tr>
                  <td style="padding:10px 0 0 0; border-top:1px solid #e8eaed;">
                    <div style="font-size:12px; font-weight:600; color:#70757a; text-transform:uppercase; letter-spacing:0.5px;">Host Organizer</div>
                    <div style="font-size:14px; color:#3c4043; margin-top:2px;">👤 {host_name} ({host_email})</div>
                  </td>
                </tr>

                {f'<tr><td style="padding:10px 0 0 0; border-top:1px solid #e8eaed;">{guests_html}</td></tr>' if guests_html else ''}
              </table>

              <!-- Call to Action Buttons -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="{meeting_link}" target="_blank" style="display:inline-block; background-color:#1a73e8; color:#ffffff; font-weight:600; font-size:15px; text-decoration:none; padding:14px 32px; border-radius:10px; box-shadow:0 2px 6px rgba(26,115,232,0.3);">
                      🎥 Join VIT Connect Video Call
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="{gcal_url}" target="_blank" style="display:inline-block; background-color:#ffffff; border:1px solid #dadce0; color:#3c4043; font-weight:600; font-size:13px; text-decoration:none; padding:10px 20px; border-radius:8px;">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" width="14" height="14" style="vertical-align:middle; margin-right:6px;" alt="GCal" />
                      Add to Google Calendar
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Meeting Link Box -->
              <div style="background-color:#f1f3f4; border-radius:8px; padding:12px 16px; font-size:13px; color:#5f6368; word-break:break-all;">
                <strong>Direct Meeting Link:</strong><br>
                <a href="{meeting_link}" style="color:#1a73e8; text-decoration:underline;">{meeting_link}</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa; border-top:1px solid #dadce0; padding:20px 32px; text-align:center; font-size:12px; color:#70757a;">
              <p style="margin:0 0 6px 0;">This email was sent via <strong>VIT Connect</strong> Conference & Scheduling System.</p>
              <p style="margin:0;">An iCalendar (.ics) invite is attached to automatically sync with your Google Calendar or device calendar.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return html

def send_email_message(
    to_email: str,
    subject: str,
    html_content: str,
    ics_content: str = None,
    ics_filename: str = "invite.ics"
) -> dict:
    """
    Send an email via Google Mail (Gmail SMTP) or log in simulation mode if credentials not configured.
    """
    smtp_server = Config.SMTP_SERVER
    smtp_port = Config.SMTP_PORT
    smtp_user = Config.SMTP_USER
    smtp_password = Config.SMTP_PASSWORD

    # Create message container
    msg = MIMEMultipart('mixed')
    msg['Subject'] = subject
    msg['From'] = f"VIT Connect <{smtp_user or 'noreply@vitconnect.edu'}>"
    msg['To'] = to_email

    # Alternative container for HTML/Text
    msg_alt = MIMEMultipart('alternative')
    
    # Plaintext fallback
    plain_text = f"{subject}\n\nPlease view this email in an HTML-compatible client."
    msg_alt.attach(MIMEText(plain_text, 'plain', 'utf-8'))
    msg_alt.attach(MIMEText(html_content, 'html', 'utf-8'))
    msg.attach(msg_alt)

    # Attach .ics calendar file if provided
    if ics_content:
        part = MIMEBase('text', 'calendar', method='REQUEST', name=ics_filename)
        part.set_payload(ics_content.encode('utf-8'))
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{ics_filename}"')
        part.add_header('Content-Class', 'urn:content-classes:calendarmessage')
        msg.attach(part)

    # Check if real SMTP credentials are provided
    if not smtp_user or not smtp_password:
        try:
            safe_subject = subject.encode('ascii', errors='replace').decode('ascii')
            print(f"\n[EMAIL SIMULATION] =========================================")
            print(f"[To]: {to_email}")
            print(f"[Subject]: {safe_subject}")
            print(f"[Status]: Delivered via Dev Simulator (Configure SMTP_USER & SMTP_PASSWORD in .env for live Gmail delivery)")
            print(f"===========================================================\n")
        except Exception:
            pass
        return {
            'success': True,
            'simulated': True,
            'recipient': to_email,
            'message': 'Email dispatched in simulated dev mode (set SMTP_USER and SMTP_PASSWORD in .env for live Gmail)'
        }


    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Successfully sent live email to {to_email}")
        return {
            'success': True,
            'simulated': False,
            'recipient': to_email,
            'message': f'Live email sent to {to_email}'
        }
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {e}")
        return {
            'success': False,
            'simulated': False,
            'recipient': to_email,
            'error': str(e)
        }

def send_meeting_schedule_notifications(
    meeting,
    host_user,
    guest_emails: list,
    start_dt: datetime,
    end_dt: datetime,
    date_str: str,
    start_time_str: str,
    end_time_str: str
) -> dict:
    """
    Send reminder and invitation emails to both the host user and all guest emails.
    """
    base_url = Config.FRONTEND_URL.rstrip('/')
    meeting_link = f"{base_url}/conference/{meeting.meeting_code or meeting.id}"
    
    # Generate Google Calendar URL
    gcal_url = generate_google_calendar_url(
        title=meeting.title,
        description=meeting.description or f"VIT Connect video conference hosted by {host_user.name}",
        start_dt=start_dt,
        end_dt=end_dt,
        meeting_link=meeting_link,
        guest_emails=guest_emails
    )
    
    # Generate .ics attachment
    ics_content = generate_ics_content(
        meeting_id=meeting.id,
        title=meeting.title,
        description=meeting.description or f"VIT Connect video conference hosted by {host_user.name}",
        start_dt=start_dt,
        end_dt=end_dt,
        meeting_link=meeting_link,
        organizer_name=host_user.name,
        organizer_email=host_user.email,
        guest_emails=guest_emails
    )

    results = []

    # 1. Send Host Reminder & Confirmation Email
    host_html = build_meeting_html_email(
        recipient_name=host_user.name,
        is_host=True,
        meeting_title=meeting.title,
        meeting_description=meeting.description or '',
        date_str=date_str,
        start_time_str=start_time_str,
        end_time_str=end_time_str,
        meeting_link=meeting_link,
        gcal_url=gcal_url,
        host_name=host_user.name,
        host_email=host_user.email,
        guest_emails=guest_emails
    )
    
    host_res = send_email_message(
        to_email=host_user.email,
        subject=f"📅 Meeting Scheduled: {meeting.title} (Reminder & GCal Sync)",
        html_content=host_html,
        ics_content=ics_content,
        ics_filename=f"{meeting.meeting_code or 'meeting'}.ics"
    )
    results.append({'target': 'host', 'email': host_user.email, 'result': host_res})

    # 2. Send Guest Invitation & Reminder Emails
    for guest_email in guest_emails:
        clean_email = guest_email.strip()
        if not clean_email or clean_email.lower() == host_user.email.lower():
            continue
            
        guest_name = clean_email.split('@')[0]
        guest_html = build_meeting_html_email(
            recipient_name=guest_name,
            is_host=False,
            meeting_title=meeting.title,
            meeting_description=meeting.description or '',
            date_str=date_str,
            start_time_str=start_time_str,
            end_time_str=end_time_str,
            meeting_link=meeting_link,
            gcal_url=gcal_url,
            host_name=host_user.name,
            host_email=host_user.email,
            guest_emails=guest_emails
        )
        
        guest_res = send_email_message(
            to_email=clean_email,
            subject=f"📅 Meeting Invitation: {meeting.title} from {host_user.name}",
            html_content=guest_html,
            ics_content=ics_content,
            ics_filename=f"{meeting.meeting_code or 'meeting'}.ics"
        )
        results.append({'target': 'guest', 'email': clean_email, 'result': guest_res})

    return {
        'google_calendar_url': gcal_url,
        'meeting_link': meeting_link,
        'dispatched_count': len(results),
        'results': results
    }
