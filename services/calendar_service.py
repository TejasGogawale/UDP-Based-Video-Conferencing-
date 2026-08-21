import urllib.parse
from datetime import datetime, timezone
import uuid

def format_datetime_for_google_calendar(dt: datetime) -> str:
    """Format datetime object into Google Calendar ISO UTC string: YYYYMMDDTHHMMSSZ"""
    if dt.tzinfo is None:
        # Assume UTC if naive
        return dt.strftime('%Y%m%dT%H%M%SZ')
    utc_dt = dt.astimezone(timezone.utc)
    return utc_dt.strftime('%Y%m%dT%H%M%SZ')

def generate_google_calendar_url(
    title: str,
    description: str,
    start_dt: datetime,
    end_dt: datetime,
    meeting_link: str,
    guest_emails: list = None
) -> str:
    """
    Generate a 1-click 'Add to Google Calendar' URL.
    """
    start_str = format_datetime_for_google_calendar(start_dt)
    end_str = format_datetime_for_google_calendar(end_dt)
    
    details = f"{description}\n\nJoin VIT Connect Meeting:\n{meeting_link}"
    
    params = {
        'action': 'TEMPLATE',
        'text': title,
        'dates': f"{start_str}/{end_str}",
        'details': details,
        'location': meeting_link,
    }
    
    if guest_emails and len(guest_emails) > 0:
        # Google calendar accepts comma-separated list in add parameter
        params['add'] = ','.join(guest_emails)
        
    return f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(params)}"

def generate_ics_content(
    meeting_id: str,
    title: str,
    description: str,
    start_dt: datetime,
    end_dt: datetime,
    meeting_link: str,
    organizer_name: str,
    organizer_email: str,
    guest_emails: list = None
) -> str:
    """
    Generate standard RFC 5545 iCalendar (.ics) string.
    """
    dtstamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    dtstart = format_datetime_for_google_calendar(start_dt)
    dtend = format_datetime_for_google_calendar(end_dt)
    uid = f"{meeting_id or uuid.uuid4()}@vitconnect.local"

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//VIT Connect//Video Conferencing & Scheduling//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:{title}",
        f"DESCRIPTION:{description}\\n\\nJoin VIT Connect Meeting: {meeting_link}",
        f"LOCATION:{meeting_link}",
        f"ORGANIZER;CN={organizer_name}:mailto:{organizer_email}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
    ]

    if guest_emails:
        for email in guest_emails:
            clean_email = email.strip()
            if clean_email:
                lines.append(f"ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{clean_email}")

    # Add standard alarm reminder 15 minutes prior
    lines.extend([
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        f"DESCRIPTION:Reminder: {title}",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ])

    return "\r\n".join(lines)
