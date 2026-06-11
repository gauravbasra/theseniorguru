import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | TheSeniorGuru",
  description: "Terms governing your use of the TheSeniorGuru platform and services.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="TheSeniorGuru home">
          <span>SG</span>
          <strong>TheSeniorGuru</strong>
        </Link>
        <nav aria-label="Site navigation">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </nav>
      </header>

      <div className="legal-page">
        <div className="legal-header">
          <span>Legal</span>
          <h1>Terms of Service</h1>
          <p>Last updated: June 8, 2025</p>
        </div>

        <div className="legal-body">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the TheSeniorGuru website (theseniorguru.com) or mobile application (collectively,
              the &ldquo;Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If
              you do not agree, do not use the Platform. These Terms apply to all users including seniors, family
              members, caregivers, service providers, and community partners.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              TheSeniorGuru is a mobile-first platform that connects seniors, families, caregivers, senior living
              communities, and trusted service providers. Features include daily care coordination, medication
              reminders, transportation assistance, community engagement, AI-assisted support, and a services
              marketplace. The Platform is currently in pre-launch and features may change without notice.
            </p>
          </section>

          <section>
            <h2>3. Eligibility</h2>
            <p>
              You must be at least 18 years old to create an account. By using the Platform you represent that you meet
              this requirement and have the legal capacity to enter into these Terms. Accounts created on behalf of
              seniors by authorized family members or caregivers are permitted with the senior&apos;s knowledge and
              consent.
            </p>
          </section>

          <section>
            <h2>4. Account Registration</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activity
              that occurs under your account. You agree to provide accurate and current information and to notify us
              promptly at <a href="mailto:support@theseniorguru.com">support@theseniorguru.com</a> if you believe your
              account has been compromised.
            </p>
          </section>

          <section>
            <h2>5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Platform for any unlawful purpose or in violation of any applicable law</li>
              <li>Impersonate another person or misrepresent your affiliation or credentials</li>
              <li>Post or transmit harmful, misleading, defamatory, or fraudulent content</li>
              <li>Attempt to gain unauthorized access to any part of the Platform or its systems</li>
              <li>Scrape, harvest, or collect user data without express written permission</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform</li>
              <li>Use the Platform to send unsolicited commercial messages</li>
              <li>Exploit seniors or vulnerable individuals in any manner</li>
            </ul>
          </section>

          <section>
            <h2>6. Service Providers and Third-Party Integrations</h2>
            <p>
              The Platform may connect you with independent third-party service providers (including through integrations
              with platforms such as Thumbtack). TheSeniorGuru does not employ these providers and is not responsible
              for their acts, omissions, or the quality of services they deliver. You engage third-party providers at
              your own risk and should conduct appropriate due diligence before engaging any provider for care-related
              services.
            </p>
            <p>
              Third-party integrations (including the Thumbtack integration accessible at{" "}
              <code>https://api.theseniorguru.com/integrations/thumbtack/callback</code>) are subject to the terms and
              privacy policies of those third parties.
            </p>
          </section>

          <section>
            <h2>7. Payments and Fees</h2>
            <p>
              Certain features or services may require payment. All fees are stated in US dollars and are non-refundable
              unless otherwise specified or required by law. We reserve the right to change our fees at any time with
              reasonable notice. You authorize us to charge your selected payment method for applicable fees.
            </p>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>
              The Platform and its content, features, and functionality (including text, graphics, logos, software, and
              the &ldquo;TheSeniorGuru&rdquo; name and marks) are owned by TheSeniorGuru / Basra Consulting Services
              and protected by applicable intellectual property laws. You may not copy, modify, distribute, or create
              derivative works without our express written consent.
            </p>
            <p>
              By submitting content to the Platform (such as reviews or community posts) you grant us a worldwide,
              royalty-free license to use, display, and distribute that content in connection with operating and
              promoting the Platform.
            </p>
          </section>

          <section>
            <h2>9. Emergency and Medical Disclaimer</h2>
            <p>
              <strong>
                The Platform is not a substitute for emergency services, professional medical care, or clinical
                judgment.
              </strong>{" "}
              In a medical emergency, call 911 immediately. The AI Companion (Guru Assistant) and wellness features are
              for informational and coordination purposes only and do not constitute medical advice, diagnosis, or
              treatment.
            </p>
          </section>

          <section>
            <h2>10. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY
              KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF
              HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2>11. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, THESENIORGURU AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
              AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
              ARISING FROM YOUR USE OF THE PLATFORM OR SERVICES OBTAINED THROUGH IT, EVEN IF ADVISED OF THE
              POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF $100
              OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless TheSeniorGuru, Basra Consulting Services, and their respective
              officers, directors, employees, and agents from any claim, loss, or damage (including reasonable legal
              fees) arising from your use of the Platform, your violation of these Terms, or your violation of any
              third-party rights.
            </p>
          </section>

          <section>
            <h2>13. Termination</h2>
            <p>
              We may suspend or terminate your access to the Platform at any time for any reason, including violation of
              these Terms, with or without notice. You may terminate your account at any time by contacting us. Sections
              8 through 14 survive termination.
            </p>
          </section>

          <section>
            <h2>14. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by the laws of the State of California without regard to its conflict-of-law
              provisions. Any dispute arising from these Terms or your use of the Platform will be resolved by binding
              arbitration under the rules of the American Arbitration Association, except that either party may seek
              injunctive relief in a court of competent jurisdiction. You waive any right to participate in a class
              action lawsuit or class-wide arbitration.
            </p>
          </section>

          <section>
            <h2>15. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by posting the revised
              Terms on this page with an updated date. Your continued use of the Platform after the effective date of
              any changes constitutes your acceptance.
            </p>
          </section>

          <section>
            <h2>16. Contact Us</h2>
            <p>Questions about these Terms? Contact us at:</p>
            <address>
              TheSeniorGuru<br />
              Basra Consulting Services<br />
              <a href="mailto:legal@theseniorguru.com">legal@theseniorguru.com</a>
            </address>
          </section>
        </div>
      </div>

      <footer className="site-footer">
        <strong>TheSeniorGuru</strong>
        <div className="footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a href="mailto:legal@theseniorguru.com">legal@theseniorguru.com</a>
        </div>
      </footer>
    </main>
  );
}
