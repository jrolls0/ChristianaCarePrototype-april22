import type { DeceasedDonorPreferencesResponse, Patient, Todo } from './types';

export const DECEASED_DONOR_PREFERENCES_TODO_TYPE: Todo['type'] =
  'deceased-donor-preferences';

export const DECEASED_DONOR_PREFERENCES_TITLE =
  'Deceased Donor Type Preferences Form';

export const DECEASED_DONOR_PREFERENCES_DESCRIPTION =
  'Review donor type preferences and save your current choices.';

export const DECEASED_DONOR_PREFERENCES_INTRO =
  'We want to learn more about what kinds of kidney donors you would feel okay considering. Your choices are not permanent. You can change them at any time. Choosing to consider any of these donor types does not mean you will have to accept it if offered. This list just helps us avoid calling you about donor offers you are not interested in at this time.\n\nYou will be given this form every 6 months, or sooner if you wish. Your feelings may change and we want you to be able to update your choices whenever you need to.\n\nPlease use the education guide that comes with this form and feel free to ask us any questions.\n\nSelect Yes or No for each donor type based on your wishes.';

export type DonorPreferenceKey = keyof DeceasedDonorPreferencesResponse['donorTypePreferences'];

export const DONOR_PREFERENCE_FIELDS: Array<{
  key: DonorPreferenceKey;
  label: string;
  education: string;
}> = [
  {
    key: 'delayedGraftFunction',
    label:
      'Donor organ may not work for days to 1-2 weeks after transplant (delayed graft function).',
    education:
      'You may need dialysis for one treatment, or sometimes for a few weeks, after your transplant while your new kidney recovers from being removed from the donor, kept on ice for hours, and then placed into you. This is extremely common in the United States. Roughly 1 in 3 kidney transplants experience this, depending on where you live.',
  },
  {
    key: 'temporaryKidneyDysfunction',
    label:
      'The donor has temporary kidney dysfunction and, in some cases, may have received a temporary form of dialysis. (This dysfunction is expected to recover.)',
    education:
      "People who suffered a catastrophic injury or medical problem, such as severe trauma, heart attack, or stroke, will often have a temporary form of kidney dysfunction known as acute kidney injury. These kidneys are not working normally and may even stop making urine, requiring a temporary form of dialysis. Once the donor's health improved, their kidneys resumed functioning. When one of these kidneys is transplanted, its function is expected to recover, and these kidneys usually do quite well after an initial period of delayed graft function. Note: the chronic kidney injury you have does not recover, which is why you are waiting for a transplant.",
  },
  {
    key: 'kdpi85OrGreater',
    label: 'The donor has a Kidney Donor Profile Index (KDPI) equal to or greater than 85%.',
    education:
      "The KDPI is a score that tells how healthy a donor's kidney is, based on things like their age, size, and health history. A score of 0% means a very healthy donor (usually young), and 100% means an older or less healthy donor. As people get older, they need less kidney function. A kidney from a 60-year-old donor might not be ideal for a 30-year-old patient, but could be a good choice for someone in their 50s or 60s. Because the score includes the donor's age, patients 50 and older may want to consider these donors to get a transplant sooner and spend less time on dialysis.",
  },
  {
    key: 'pastHcv',
    label: 'The donor has evidence of past, not current, infection with hepatitis C virus (HCV).',
    education:
      'The donor has antibodies to HCV, but no evidence of the virus currently in their system. This is evidence of past, not current, infection. The risk of a recipient developing HCV infection from this type of donor is very low. You would be checked for HCV after your transplant regardless, and HCV is highly curable with easy-to-take oral medication (pills).',
  },
  {
    key: 'currentHcv',
    label: 'The donor has a current infection with hepatitis C virus (HCV).',
    education:
      'The donor has a current infection with HCV, with virus in their system. These donors are safe for most people to receive because HCV is highly curable. Our program gives the recipient the first dose of HCV medication before the organ is implanted, continuing daily for a week, with regular testing during and after. In the unlikely event a week is not enough, treatment continues for 12 weeks. The goal is for you to walk away with a well-functioning kidney and without HCV. If you are interested in this pathway, we will give you an additional consent form to review and sign, and do some additional non-invasive testing of your liver during your evaluation.',
  },
  {
    key: 'pastHbv',
    label: 'The donor has evidence of past, not current, infection with hepatitis B virus (HBV).',
    education:
      'The donor has antibodies to HBV, but no evidence of the actual virus in their system. This is evidence of past, not current, infection. Patients who accept one of these donors will be placed on a preventive daily pill and checked for HBV after transplant. With this type of donor and preventive treatment, the chance of the recipient developing HBV infection is very, very low. We encourage all our patients to get the HBV vaccination for their general safety.',
  },
  {
    key: 'currentHbv',
    label: 'The donor has a current infection with hepatitis B virus (HBV).',
    education:
      'The donor has a current infection with HBV, with virus in their system. You would receive preventive medication (an easy-to-take daily pill) beginning just before transplant and continued indefinitely. With this treatment, the chance of developing HBV infection is low, and you would be monitored afterward. The goal is for you to walk away with a well-functioning kidney and without HBV.',
  },
  {
    key: 'increasedInfectiousDiseaseRisk',
    label:
      'The donor encountered experiences which could increase their risk of having infectious diseases (such as IV drug use, prostitution, massive blood transfusion, etc.).',
    education:
      'These are things the donor did or experienced, such as IV drug use, prostitution, or receiving a large amount of blood product transfusion, which could raise their risk of having infections like hepatitis B or C, HIV, or syphilis. These illnesses are routinely tested in all donors in the United States, and the risk of transmitting them to the recipient is low. Most of these, except HIV, can be cured. HIV cannot be cured, but in the very unlikely event it was passed through a transplant, there is effective long-term treatment and people with HIV can live mostly normal lives on regular oral medication.',
  },
  {
    key: 'dualTransplant',
    label:
      'The organ agency could offer both of the donor\'s kidneys to you (a "dual transplant"), in cases of older donors or donors with a more extensive medical history.',
    education:
      "If the donor's kidneys are of lower quality, the organ recovery agency will sometimes offer both to put into the same recipient. The expectation is that the combination of two lower-quality kidneys equals having a single better-quality kidney, allowing you to get off dialysis sooner and for a good length of time. Because two kidneys are implanted, the surgery is more extensive and takes longer, but in our experience the recovery is not much different than for a single kidney transplant.",
  },
];

export const MAX_DONOR_AGE_EDUCATION =
  'As we get older, our need for kidney function goes down, and kidney function also naturally decreases with age. Still, the health of a donor kidney can vary from person to person. Some 70-year-olds may have kidneys that look and work very well, while some 50-year-olds may not. When we review a donor, we look at age but also many other factors. If you are open to kidneys from donors of many ages, you may have a better chance of getting a transplant sooner.';

export function latestDeceasedDonorPreferences(
  patient: Pick<Patient, 'deceasedDonorPreferencesResponses'>
): DeceasedDonorPreferencesResponse | undefined {
  return patient.deceasedDonorPreferencesResponses
    ?.slice()
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
}

export function previousDeceasedDonorPreferences(
  patient: Pick<Patient, 'deceasedDonorPreferencesResponses'>
): DeceasedDonorPreferencesResponse[] {
  return (
    patient.deceasedDonorPreferencesResponses
      ?.slice()
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(1) ?? []
  );
}

export function declinedDonorPreferenceLabels(
  response: DeceasedDonorPreferencesResponse
): string[] {
  return DONOR_PREFERENCE_FIELDS.filter(
    (field) => response.donorTypePreferences[field.key] === 'no'
  ).map((field) => field.label);
}

export function donorAgePreferenceLabel(
  response: Pick<DeceasedDonorPreferencesResponse, 'maximumDonorAge' | 'noMaximumAgeLimit'>
): string {
  if (response.noMaximumAgeLimit) return 'No limit';
  return response.maximumDonorAge ? `${response.maximumDonorAge}` : 'Not recorded';
}
