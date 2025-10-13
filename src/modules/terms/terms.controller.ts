import { Controller, Get } from '@nestjs/common';

@Controller('terms-and-conditions')
export class TermsController {
  @Get()
  getTerms() {
    return {
      title: 'Edupulse Terms and Conditions',
      effective_date: '[Insert Date]',
      last_updated: '[Insert Date]',
      content: `
Welcome to Edupulse, an AI-based marketing platform designed to assist educational institutions in creating marketing content and communication materials. By subscribing to or using Edupulse (“the Service”), you (“the User”, “Customer”, or “Subscriber”) agree to be bound by the following Terms and Conditions (“Agreement”). Please read these terms carefully before using the Service.

1. Acceptance of Terms
By accessing or using Edupulse, you confirm that you have read, understood, and agree to be bound by this Agreement. If you do not agree with these Terms and Conditions, you must not use the Service.

2. Account Registration and Access
You must create an account to access Edupulse’s features.
You agree to provide accurate and complete information when registering and to keep this information up to date.
Your login credentials (username, password, or access tokens) are personal and non-transferable.

3. Prohibition on Sharing Login Details
You must not share your login details or account access with any other person, institution, or third party.
If your login credentials are shared — intentionally or unintentionally — you will be fully liable for:
- Any loss of revenue suffered by Edupulse as a result of such sharing; and
- Any misuse, unauthorized access, or data breaches arising from the shared access.
Edupulse reserves the right to conduct random spot checks to verify account usage and detect unauthorized sharing.
If unauthorized access is detected, Edupulse may, at its sole discretion:
- Suspend or terminate your account;
- Invoice you for lost revenue; and
- Pursue legal remedies as appropriate.

4. Use of the Service
Edupulse provides AI-generated marketing content, including but not limited to social media posts, emails, copywriting, and design recommendations.
The content generated is intended to assist your marketing activities but is not a substitute for professional judgment.
You agree to use the Service responsibly and in compliance with all applicable laws, regulations, and school policies.

5. Accuracy and Responsibility for AI-Generated Content
Edupulse uses advanced AI technology to generate content; however, the output may not always be accurate, complete, or appropriate.
You acknowledge that it is your sole responsibility to fact-check, verify, and review all content generated before publishing, distributing, or relying upon it.
Edupulse does not guarantee the accuracy, legality, or reliability of any AI-generated material.
You accept full liability for any content you publish, share, or act upon that has been created or assisted by Edupulse.

6. Limitation of Liability
Edupulse, its owners, employees, and affiliates shall not be liable for any direct, indirect, incidental, consequential, or special damages, including but not limited to loss of data, profits, or goodwill, arising from the use or inability to use the Service.
Edupulse shall not be responsible for any reputational damage, regulatory breach, or legal action arising from the User’s use of AI-generated content.

7. Intellectual Property
Edupulse retains all rights, title, and interest in the platform, its technology, algorithms, and branding.
Users are granted a limited, non-exclusive, non-transferable license to use the Service for lawful marketing purposes related to their institution.

8. Termination
Edupulse reserves the right to suspend or terminate any account that violates these Terms and Conditions, including (but not limited to) unauthorized sharing of login credentials or misuse of the Service.
Upon termination, your access to Edupulse will cease immediately, and no refund will be issued.

9. Data Protection
Edupulse processes limited user data for the purpose of account management and service delivery in accordance with applicable data protection laws. For more details, please refer to our [Privacy Policy].

10. Amendments
Edupulse may update or amend these Terms and Conditions at any time. Continued use of the Service after such updates constitutes acceptance of the revised terms.

11. Governing Law
This Agreement shall be governed by and construed in accordance with the laws of [Insert Jurisdiction], and any disputes shall be subject to the exclusive jurisdiction of the courts located in [Insert Location].

12. Contact Information
If you have any questions regarding these Terms and Conditions, please contact:
Edupulse Support Team
Email: [Insert Contact Email]
Website: [Insert Website URL]
      `,
    };
  }
}
