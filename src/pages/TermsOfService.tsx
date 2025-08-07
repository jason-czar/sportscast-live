import AppHeader from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Terms of Service</CardTitle>
            <p className="text-center text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          
          <CardContent className="prose max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>By accessing and using our live streaming platform, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Our platform provides live streaming and video conferencing services that allow users to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Create and manage live streaming events</li>
                  <li>Join events as camera operators or viewers</li>
                  <li>Stream video content in real-time</li>
                  <li>Collaborate on multi-camera productions</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>To access certain features of the service, you must register for an account. You agree to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Provide accurate and complete information during registration</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                  <li>Take responsibility for all activities that occur under your account</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>You agree not to use the service to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Upload, post, or transmit any content that is illegal, harmful, or offensive</li>
                  <li>Violate any laws or regulations</li>
                  <li>Infringe on the intellectual property rights of others</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Interfere with or disrupt the service or servers</li>
                  <li>Use the service for any commercial purpose without permission</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Content and Intellectual Property</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Regarding content you share through our platform:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>You retain ownership of your original content</li>
                  <li>You grant us a license to use, display, and transmit your content as necessary to provide the service</li>
                  <li>You are responsible for ensuring you have rights to all content you share</li>
                  <li>We may remove content that violates these terms</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Live Streaming Guidelines</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>When participating in live streams:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Respect other participants and maintain appropriate conduct</li>
                  <li>Do not share personal information of others without consent</li>
                  <li>Follow the specific rules set by event organizers</li>
                  <li>Understand that streams may be recorded or saved</li>
                  <li>Report any inappropriate behavior to moderators</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Privacy and Data Protection</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Service Availability</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We strive to maintain service availability but:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The service is provided "as is" without guarantees of uptime</li>
                  <li>We may need to interrupt service for maintenance</li>
                  <li>Internet connectivity issues may affect streaming quality</li>
                  <li>We are not liable for service interruptions beyond our control</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We may terminate or suspend your account and access to the service immediately, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We reserve the right to modify these terms at any time. We will notify users of significant changes by posting the updated terms on our platform and updating the "Last updated" date.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>If you have any questions about these Terms of Service, please contact us through our support channels.</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}