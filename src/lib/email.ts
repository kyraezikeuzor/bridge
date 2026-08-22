import { Resend } from "resend";

const FROM = "Omelora <team@omelora.org>";

/** Template aliases — must match Resend dashboard aliases exactly (case-sensitive). */
export const EMAIL_TEMPLATE_ALIASES = {
  magicLink: "magic-link",
  volunteerAcceptance: "volunteer-acceptance",
  volunteerRejection: "volunteer-rejection",
  hoursApproved: "hours-approved",
  hoursRejected: "hours-rejected",
  commentReply: "comment-reply",
  volunteerRoundup: "volunteer-roundup",
} as const;

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  const present = Boolean(apiKey && apiKey.trim());
  console.log(
    `[email] RESEND_API_KEY present: ${present}${
      present ? ` (length=${apiKey!.trim().length})` : ""
    }`
  );
  if (!present) {
    throw new Error("Missing RESEND_API_KEY environment variable");
  }
  return new Resend(apiKey);
}

type SendTemplateArgs = {
  label: string;
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string | number>;
};

async function sendTemplateEmail({
  label,
  to,
  subject,
  templateId,
  variables,
}: SendTemplateArgs) {
  console.log(`[email] ${label} — starting send`, {
    to,
    subject,
    templateId,
    variableKeys: Object.keys(variables),
    variables,
    from: FROM,
  });

  let resend: Resend;
  try {
    resend = getResend();
  } catch (err) {
    console.error(`[email] ${label} — failed before Resend call:`, err);
    throw err;
  }

  let data: unknown = null;
  let error: unknown = null;

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      template: {
        id: templateId,
        variables,
      },
    });
    data = result.data;
    error = result.error;
  } catch (err) {
    console.error(
      `[email] ${label} — Resend emails.send threw:`,
      err
    );
    console.error(
      `[email] ${label} — thrown error (JSON):`,
      JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2)
    );
    throw err;
  }

  console.log(
    `[email] ${label} — Resend raw response:`,
    JSON.stringify({ data, error }, null, 2)
  );

  if (error) {
    console.error(`[email] ${label} — Resend returned error object:`, error);
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : JSON.stringify(error);
    throw new Error(`Resend ${label} failed: ${message}`);
  }

  const id =
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof (data as { id: unknown }).id === "string"
      ? (data as { id: string }).id
      : "unknown";

  console.log(`[email] ${label} — sent OK to ${to} (id: ${id})`);
  return data;
}

/**
 * Send the magic-link Resend template.
 * Template alias: "magic-link" — expects {{url}}.
 */
export async function sendMagicLinkEmail(to: string, url: string) {
  return sendTemplateEmail({
    label: "magic-link",
    to,
    subject: "Sign in to Omelora Bridge",
    templateId: EMAIL_TEMPLATE_ALIASES.magicLink,
    variables: { url },
  });
}

/**
 * Send volunteer acceptance email.
 * Template alias: "volunteer-acceptance" — expects {{firstName}}, {{tracks}}.
 */
export async function sendVolunteerAcceptanceEmail(
  to: string,
  firstName: string,
  tracks: string
) {
  return sendTemplateEmail({
    label: "volunteer-acceptance",
    to,
    subject: `Welcome to Omelora, ${firstName}!`,
    templateId: EMAIL_TEMPLATE_ALIASES.volunteerAcceptance,
    variables: {
      firstName,
      tracks,
    },
  });
}

/**
 * Send volunteer rejection email.
 * Template alias: "volunteer-rejection" — expects {{firstName}}.
 */
export async function sendVolunteerRejectionEmail(
  to: string,
  firstName: string
) {
  return sendTemplateEmail({
    label: "volunteer-rejection",
    to,
    subject: "Omelora Volunteer Application Update",
    templateId: EMAIL_TEMPLATE_ALIASES.volunteerRejection,
    variables: {
      firstName,
    },
  });
}

/**
 * Send hours-approved email.
 * Template alias: "hours-approved" — expects {{firstName}}, {{activityName}}, {{url}}.
 */
export async function sendHoursApprovedEmail(
  to: string,
  firstName: string,
  activityName: string,
  url: string
) {
  return sendTemplateEmail({
    label: "hours-approved",
    to,
    subject: "Your Volunteer Hours Have Been Approved",
    templateId: EMAIL_TEMPLATE_ALIASES.hoursApproved,
    variables: {
      firstName,
      activityName,
      url,
    },
  });
}

/**
 * Send hours update email when hours were not approved.
 * Template alias: "hours-rejected" — expects {{firstName}}, {{activityName}},
 * {{reason}}, {{url}}.
 * Copy uses "has not been approved" (never "rejected").
 */
export async function sendHoursRejectedEmail(
  to: string,
  firstName: string,
  activityName: string,
  reason: string,
  url: string
) {
  return sendTemplateEmail({
    label: "hours-rejected",
    to,
    subject: "Your Volunteer Hours Have Been Updated",
    templateId: EMAIL_TEMPLATE_ALIASES.hoursRejected,
    variables: {
      firstName,
      activityName,
      reason,
      url,
    },
  });
}

/**
 * Send a reply to an applicant comment/message.
 * Template alias: "comment-reply" — expects {{firstName}}, {{applicantMessage}}, {{replyMessage}}.
 * NOTE: Resend currently lists this template as status "draft" — publish it or sends will fail.
 */
export async function sendCommentReplyEmail(
  to: string,
  firstName: string,
  applicantMessage: string,
  replyMessage: string
) {
  return sendTemplateEmail({
    label: "comment-reply",
    to,
    subject: "Re: Your Omelora Application",
    templateId: EMAIL_TEMPLATE_ALIASES.commentReply,
    variables: {
      firstName,
      applicantMessage,
      replyMessage,
    },
  });
}

/**
 * Send the volunteer roundup email — a roster-wide note carrying the current
 * Discord invite.
 *
 * Copy is deliberately neutral rather than an apology: it goes to every
 * volunteer, most of whom never received the dead invite and would be confused
 * by an apology for an email they never got.
 *
 * Template alias: "volunteer-roundup" — expects {{firstName}}, {{discordUrl}}.
 */
export async function sendVolunteerRoundupEmail(
  to: string,
  firstName: string,
  discordUrl: string
) {
  // firstName is "" when we have no name on file. Personalize the subject only
  // when we actually have one — "…, there" reads as a broken mail merge.
  const name = firstName.trim();
  const subject = name
    ? `Your new Omelora Discord invite, ${name}`
    : "Your new Omelora Discord invite";

  return sendTemplateEmail({
    label: "volunteer-roundup",
    to,
    subject,
    templateId: EMAIL_TEMPLATE_ALIASES.volunteerRoundup,
    variables: {
      // The body greeting still needs something to address.
      firstName: name || "there",
      discordUrl,
    },
  });
}
