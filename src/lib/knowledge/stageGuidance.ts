import type { AmeliaActionTarget, PatientStage } from '../types';
import { PATIENT_STAGE_LABEL } from '../stages';

export type StageOwner = 'patient' | 'transplant-center' | 'dialysis-clinic' | 'shared';

export type StageGuidance = {
  stage: PatientStage;
  label: string;
  owner: StageOwner;
  patientSummary: string;
  patientCanDo: string[];
  avoidPromising: string;
  primaryActionTarget?: AmeliaActionTarget;
};

export const AMELIA_STAGE_GUIDANCE: Record<PatientStage, StageGuidance> = {
  'new-referral': {
    stage: 'new-referral',
    label: PATIENT_STAGE_LABEL['new-referral'],
    owner: 'dialysis-clinic',
    patientSummary:
      'A referral has been started, but the patient portal account is not active yet.',
    patientCanDo: ['Register for the patient portal when invited.'],
    avoidPromising: 'Do not say the patient is signed in or fully onboarded.',
  },
  onboarding: {
    stage: 'onboarding',
    label: PATIENT_STAGE_LABEL.onboarding,
    owner: 'patient',
    patientSummary:
      'The patient is signing the two ROI forms and choosing communication preferences.',
    patientCanDo: [
      'Finish the Services ROI.',
      'Finish the Medical Records ROI.',
      'Choose email, SMS, or phone contact preferences.',
    ],
    avoidPromising: 'Do not skip consent steps or imply Amelia can sign forms.',
    primaryActionTarget: 'tab:home',
  },
  'initial-todos': {
    stage: 'initial-todos',
    label: PATIENT_STAGE_LABEL['initial-todos'],
    owner: 'patient',
    patientSummary:
      'The patient needs to complete the required intake tasks before staff review.',
    patientCanDo: [
      'Upload Government ID.',
      'Upload Insurance Card front and back.',
      'Complete the health questionnaire.',
      'Optionally add an emergency contact.',
    ],
    avoidPromising: 'Do not say the case can advance until required tasks are complete.',
    primaryActionTarget: 'tab:home',
  },
  'initial-screening': {
    stage: 'initial-screening',
    label: PATIENT_STAGE_LABEL['initial-screening'],
    owner: 'transplant-center',
    patientSummary:
      'ChristianaCare staff are reviewing the questionnaire responses and deciding whether to move the case to financial screening.',
    patientCanDo: [
      'Watch for messages from ChristianaCare.',
      'Reply quickly if the care team asks for clarification.',
      'Use Messages to ask what is being reviewed.',
    ],
    avoidPromising: 'Do not interpret questionnaire answers or predict approval.',
    primaryActionTarget: 'tab:messages',
  },
  'financial-screening': {
    stage: 'financial-screening',
    label: PATIENT_STAGE_LABEL['financial-screening'],
    owner: 'transplant-center',
    patientSummary:
      'The transplant center is reviewing insurance and financial clearance needs.',
    patientCanDo: [
      'Keep insurance information current in Profile.',
      'Reply if the care team asks for updated coverage details.',
    ],
    avoidPromising: 'Do not confirm coverage or out-of-pocket costs.',
    primaryActionTarget: 'tab:messages',
  },
  'records-clinical-review': {
    stage: 'records-clinical-review',
    label: PATIENT_STAGE_LABEL['records-clinical-review'],
    owner: 'shared',
    patientSummary:
      'The care team is gathering and reviewing records and clinical context outside the patient portal.',
    patientCanDo: [
      'Watch for document or clarification requests.',
      'Message the care team if a clinic or record source changes.',
    ],
    avoidPromising: 'Do not claim all outside records are visible in this prototype.',
    primaryActionTarget: 'tab:messages',
  },
  'final-decision': {
    stage: 'final-decision',
    label: PATIENT_STAGE_LABEL['final-decision'],
    owner: 'transplant-center',
    patientSummary:
      'The transplant center is making a final decision about the next step in the referral.',
    patientCanDo: ['Watch for messages from the care team.'],
    avoidPromising: 'Do not predict the decision or eligibility result.',
    primaryActionTarget: 'tab:messages',
  },
  education: {
    stage: 'education',
    label: PATIENT_STAGE_LABEL.education,
    owner: 'patient',
    patientSummary:
      'The patient may need to complete transplant education before the referral can move forward.',
    patientCanDo: ['Complete any education task shown in the To-Do List.'],
    avoidPromising: 'Do not describe scheduling as handled by Amelia.',
    primaryActionTarget: 'tab:home',
  },
  scheduling: {
    stage: 'scheduling',
    label: PATIENT_STAGE_LABEL.scheduling,
    owner: 'transplant-center',
    patientSummary:
      'The transplant center is coordinating the next appointment outside this patient app.',
    patientCanDo: ['Reply to messages about availability.'],
    avoidPromising: 'Do not book, reschedule, or cancel appointments.',
    primaryActionTarget: 'tab:messages',
  },
};

export function getStageGuidance(stage: PatientStage): StageGuidance {
  return AMELIA_STAGE_GUIDANCE[stage] ?? AMELIA_STAGE_GUIDANCE.onboarding;
}
