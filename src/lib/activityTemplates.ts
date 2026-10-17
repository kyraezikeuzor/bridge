export const CARE_KIT_GUIDE = "https://docs.google.com/document/d/13Vm3mCnkjCBIay0WWpdI4QEVns4jTTcsNDk4rSaMLtw/edit";
export const SCHOOL_KIT_GUIDE = "https://docs.google.com/document/d/1u6P73nRq_GnW9ad-z45RvmPX_ZTstA6SqSNfjE-hqeQ/edit";

export const PROJECT_ACTIVITY_TEMPLATES = {
  "Letters": {
    type: "Submission", minimum: 30, guideUrl: "",
    instructions: "Write at least 30 thoughtful letters in Bridge. Do not include private contact information. Omelora reviews, prints, and mails approved letters to the selected center. The project is completed only after mailing or receipt is verified.",
  },
  "Care Kits": {
    type: "Submission", minimum: 30, guideUrl: CARE_KIT_GUIDE,
    instructions: "Create at least 30 complete care kits. Each kit must use a gallon resealable bag and include unopened travel-size toothpaste, toothbrush, soap or body wash, and deodorant. Deliver directly to the selected center by shipping or in person; Omelora has no PO box. Submit item photos plus tracking, or an in-person delivery photo with a consenting center associate / written center confirmation.",
  },
  "School Kits": {
    type: "Submission", minimum: 30, guideUrl: SCHOOL_KIT_GUIDE,
    instructions: "Create at least 30 complete school kits in resealable bags using unopened supplies. Children kits include a mini notebook and crayons; youth kits include a mini notebook, pencils, and colored pencils. Deliver directly to the selected center by shipping or in person; Omelora has no PO box. Submit item photos plus tracking, or an in-person delivery photo with a consenting center associate / written center confirmation.",
  },
  "Service Day": {
    type: "Participation", minimum: 1, guideUrl: "",
    instructions: "Attend and complete the service work at the selected center during the listed date and time. Follow the center's safety and supervision rules. Submit a center confirmation and a short description of the service completed. Do not photograph children or private information.",
  },
  "Center Wish": {
    type: "Submission", minimum: 1, guideUrl: "",
    instructions: "Fulfill the specific item or need requested by the selected center. You may fundraise or source an approved second-hand item. Confirm acceptability with the center before purchasing or collecting it, then submit item and delivery evidence.",
  },
} as const;

export type ProjectActivityCategory = keyof typeof PROJECT_ACTIVITY_TEMPLATES;
