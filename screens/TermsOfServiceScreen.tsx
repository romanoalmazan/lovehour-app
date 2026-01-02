import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { acceptTermsOfService } from '../services/userService';

type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  LoveHour: undefined;
  UserProfileSetup: undefined;
  ChoosePartner: undefined;
  TermsOfService: undefined;
};

type TermsOfServiceScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TermsOfService'>;

const TermsOfServiceScreen: React.FC = () => {
  const navigation = useNavigation<TermsOfServiceScreenNavigationProp>();
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleAccept = async () => {
    if (!accepted) {
      Alert.alert('Error', 'Please read and accept the Terms of Service to continue');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const result = await acceptTermsOfService(user.uid);

      if (result.success) {
        // Terms accepted - App.tsx navigation logic will automatically navigate to profile setup
        // The subscription in App.tsx will detect the change and show UserProfileSetup screen
        setLoading(false);
      } else {
        Alert.alert('Error', result.error || result.message || 'Failed to accept terms of service');
        setLoading(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept terms of service');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Terms of Service for LoveHour App</Text>
          <Text style={styles.effectiveDate}>Effective Date: {effectiveDate}</Text>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              Welcome to LoveHour, a relationship companion app designed for couples to share scheduled photo and caption updates. These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and LoveHour Team ("LoveHour," "we," "us," or "our") regarding your use of the LoveHour mobile application and any related services (collectively, the "App").
{'\n\n'}
              By accessing, downloading, installing, or using the LoveHour App, you signify that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree with any part of these Terms or our Privacy Policy, you must not use or access the App.
{'\n\n'}
              <Text style={styles.sectionTitle}>1. Acceptance of Terms{'\n'}</Text>
              <Text style={styles.subsectionTitle}>1.1. Agreement:{'\n'}</Text>
              By creating an account, sending User Content (as defined below), or otherwise using any part of the App, you represent that you have read, understood, and agree to be bound by these Terms.
{'\n\n'}
              <Text style={styles.subsectionTitle}>1.2. Privacy Policy:{'\n'}</Text>
              Your use of the App is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy [Link to your Privacy Policy] to understand our practices regarding your data.
{'\n\n'}
              <Text style={styles.subsectionTitle}>1.3. Changes to Terms:{'\n'}</Text>
              We reserve the right to modify these Terms at any time. If we make material changes, we will notify you by updating the "Effective Date" at the top of these Terms, posting a notice within the App, or sending you an email. Your continued use of the App after such modifications will constitute your acknowledgment of the modified Terms and agreement to abide and be bound by them.
{'\n\n'}
              <Text style={styles.sectionTitle}>2. Eligibility and User Accounts{'\n'}</Text>
              <Text style={styles.subsectionTitle}>2.1. Age Requirement:{'\n'}</Text>
              You must be at least eighteen (18) years of age to use the LoveHour App. By creating an account and using the App, you represent and warrant that you are 18 years of age or older.
{'\n\n'}
              <Text style={styles.subsectionTitle}>2.2. Account Creation:{'\n'}</Text>
              To use the LoveHour App, you must register for an account, providing an email address or other specified registration method. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
{'\n\n'}
              <Text style={styles.subsectionTitle}>2.3. Account Security:{'\n'}</Text>
              You are solely responsible for maintaining the confidentiality of your account credentials (e.g., username, password). You are fully responsible for all activities that occur under your account. You agree to notify LoveHour immediately of any unauthorized use of your account or any other breach of security. LoveHour will not be liable for any loss or damage arising from your failure to comply with this section.
{'\n\n'}
              <Text style={styles.subsectionTitle}>2.4. Single User per Account:{'\n'}</Text>
              Each individual user must maintain their own distinct LoveHour account. LoveHour is designed for two individual accounts to be linked as a couple. You may not share your account credentials with anyone, including your partner.
{'\n\n'}
              <Text style={styles.sectionTitle}>3. User Content{'\n'}</Text>
              <Text style={styles.subsectionTitle}>3.1. Definition:{'\n'}</Text>
              "User Content" refers to any photos, images, captions, text, messages, or other content that you upload, post, share, or transmit through the LoveHour App.
{'\n\n'}
              <Text style={styles.subsectionTitle}>3.2. Ownership of User Content:{'\n'}</Text>
              You retain all ownership rights in and to your User Content. LoveHour does not claim ownership of your User Content.
{'\n\n'}
              <Text style={styles.subsectionTitle}>3.3. License to LoveHour:{'\n'}</Text>
              By submitting User Content through the App, you grant LoveHour a limited, non-exclusive, royalty-free, worldwide, sublicensable license to host, store, display, perform, transmit, and distribute your User Content solely for the purpose of operating, improving, and providing the LoveHour App and its features to you and your connected partner. This license terminates when you delete your User Content or your account, unless your User Content has been shared with others (e.g., your partner) who have not deleted it, or if it is required to be retained by law.
{'\n\n'}
              <Text style={styles.subsectionTitle}>3.4. Your Responsibilities for User Content:{'\n'}</Text>
              You are solely responsible for your User Content, including its legality, reliability, accuracy, and appropriateness. You represent and warrant that:
{'\n\n'}
              You own the User Content or have all necessary rights, licenses, consents, and permissions to use and authorize LoveHour to use your User Content as contemplated by these Terms.
{'\n'}
              Your User Content does not infringe upon, misappropriate, or violate the intellectual property rights, privacy rights, publicity rights, or any other rights of any third party.
{'\n'}
              Your User Content will not violate any applicable law or regulation.
{'\n\n'}
              <Text style={styles.subsectionTitle}>3.5. Prohibited User Content:{'\n'}</Text>
              You agree not to upload, post, share, or transmit any User Content that:
{'\n\n'}
              • Is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, pornographic, sexually explicit, libelous, invasive of another's privacy, hateful, or racially, ethnically, or otherwise objectionable.
{'\n'}
              • Promotes or depicts child sexual exploitation or abuse.
{'\n'}
              • Promotes or encourages violence, self-harm, or discrimination.
{'\n'}
              • Infringes any patent, trademark, trade secret, copyright, or other proprietary rights of any party.
{'\n'}
              • Contains software viruses or any other computer code, files, or programs designed to interrupt, destroy, or limit the functionality of any computer software or hardware or telecommunications equipment.
{'\n'}
              • Constitutes non-consensual sexual content (e.g., "revenge porn").
{'\n'}
              • Impersonates any person or entity, or falsely states or misrepresents your affiliation with a person or entity.
{'\n'}
              • Is generated or shared without the explicit consent of all individuals depicted or mentioned therein.
{'\n\n'}
              <Text style={styles.subsectionTitle}>3.6. Monitoring and Enforcement:{'\n'}</Text>
              LoveHour reserves the right, but not the obligation, to monitor, review, or remove User Content at our sole discretion, without notice, if we believe it violates these Terms, is otherwise inappropriate, or is harmful to us, our users, or third parties. We may also take action against any user who violates this section, including account suspension or termination.
{'\n\n'}
              <Text style={styles.sectionTitle}>4. Acceptable Use Policy{'\n'}</Text>
              <Text style={styles.subsectionTitle}>4.1. General Use:{'\n'}</Text>
              You agree to use the LoveHour App only for its intended purpose: to share private, scheduled updates with your designated partner.
{'\n\n'}
              <Text style={styles.subsectionTitle}>4.2. Prohibited Activities:{'\n'}</Text>
              You agree not to:
{'\n\n'}
              • Use the App for any illegal or unauthorized purpose.
{'\n'}
              • Engage in any form of harassment, bullying, or abuse of other users.
{'\n'}
              • Impersonate any person or entity, or falsely state or otherwise misrepresent yourself or your affiliation with any person or entity.
{'\n'}
              • Interfere with or disrupt the integrity or performance of the App or the data contained therein.
{'\n'}
              • Attempt to gain unauthorized access to the App or its related systems or networks.
{'\n'}
              • Reverse engineer, decompile, disassemble, or otherwise attempt to discover the source code of the App.
{'\n'}
              • Use the App for any commercial purpose without our express written consent.
{'\n'}
              • Upload or transmit any malicious code, viruses, or other harmful components.
{'\n'}
              • Use any automated system, including "robots," "spiders," or "offline readers," to access the App in a manner that sends more request messages to our servers than a human can reasonably produce in the same period by using a conventional web browser.
{'\n\n'}
              <Text style={styles.sectionTitle}>5. Intellectual Property Rights of LoveHour{'\n'}</Text>
              <Text style={styles.subsectionTitle}>5.1. LoveHour IP:{'\n'}</Text>
              The App, its entire contents, features, and functionality (including but not limited to all information, software, text, displays, images, video, and audio, and the design, selection, and arrangement thereof), are owned by LoveHour, its licensors, or other providers of such material and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
{'\n\n'}
              <Text style={styles.subsectionTitle}>5.2. Limited License to You:{'\n'}</Text>
              Subject to these Terms, LoveHour grants you a limited, non-exclusive, non-transferable, revocable license to install and use the App for your personal, non-commercial use on a mobile device that you own or control.
{'\n\n'}
              <Text style={styles.subsectionTitle}>5.3. Trademarks:{'\n'}</Text>
              The LoveHour name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of LoveHour or its affiliates or licensors. You must not use such marks without the prior written permission of LoveHour.
{'\n\n'}
              <Text style={styles.sectionTitle}>6. Privacy Policy{'\n'}</Text>
              Your use of the App is subject to LoveHour's Privacy Policy, located at [Link to your Privacy Policy]. Our Privacy Policy explains how we collect, use, and disclose information that pertains to your privacy. By using the App, you agree to the practices described in our Privacy Policy.
{'\n\n'}
              <Text style={styles.sectionTitle}>7. Third-Party Services and Links{'\n'}</Text>
              The App may contain links to third-party websites or services that are not owned or controlled by LoveHour. LoveHour has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that LoveHour shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods, or services available on or through any such third-party websites or services. We strongly advise you to read the terms and conditions and privacy policies of any third-party websites or services that you visit.
{'\n\n'}
              <Text style={styles.sectionTitle}>8. Disclaimers{'\n'}</Text>
              <Text style={styles.subsectionTitle}>8.1. "AS IS" and "AS AVAILABLE":{'\n'}</Text>
              THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE PURSUANT TO APPLICABLE LAW, LOVEHOUR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY OF INFORMATION.
{'\n\n'}
              <Text style={styles.subsectionTitle}>8.2. No Guarantee:{'\n'}</Text>
              LOVEHOUR DOES NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE DO NOT WARRANT THAT THE RESULTS THAT MAY BE OBTAINED FROM THE USE OF THE APP WILL BE ACCURATE OR RELIABLE.
{'\n\n'}
              <Text style={styles.subsectionTitle}>8.3. User Content & Interactions:{'\n'}</Text>
              LOVEHOUR IS NOT RESPONSIBLE FOR THE CONTENT OR BEHAVIOR OF OTHER USERS, YOUR PARTNER, OR THIRD PARTIES. YOU ENGAGE WITH OTHER USERS AND YOUR PARTNER AT YOUR OWN RISK. WE DO NOT VERIFY THE IDENTITY OR BACKGROUND OF ANY USERS.
{'\n\n'}
              <Text style={styles.subsectionTitle}>8.4. Relationship Status:{'\n'}</Text>
              LOVEHOUR IS A TOOL TO FACILITATE COMMUNICATION AND IS NOT RESPONSIBLE FOR THE OUTCOME, DURATION, OR HEALTH OF ANY RELATIONSHIP.
{'\n\n'}
              <Text style={styles.sectionTitle}>9. Limitation of Liability{'\n'}</Text>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL LOVEHOUR, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION, DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE APP, EVEN IF LOVEHOUR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
{'\n\n'}
              OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE APP SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO LOVEHOUR FOR YOUR USE OF THE APP IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED US DOLLARS ($100.00).
{'\n\n'}
              <Text style={styles.sectionTitle}>10. Indemnification{'\n'}</Text>
              You agree to defend, indemnify, and hold harmless LoveHour, its affiliates, licensors, and service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:
{'\n\n'}
              Your violation of these Terms.
{'\n'}
              Your use of the App, including, but not limited to, your User Content.
{'\n'}
              Your violation of any rights of another party, including intellectual property rights or privacy rights.
{'\n\n'}
              <Text style={styles.sectionTitle}>11. Termination{'\n'}</Text>
              <Text style={styles.subsectionTitle}>11.1. By LoveHour:{'\n'}</Text>
              We may terminate or suspend your account and access to the App immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms. We may also terminate or suspend your account if we determine, in our sole discretion, that your conduct is harmful to us, our users, or third parties.
{'\n\n'}
              <Text style={styles.subsectionTitle}>11.2. By You:{'\n'}</Text>
              You may terminate your account at any time by following the instructions within the App or by contacting us at almazanroman888@gmail.com.
{'\n\n'}
              <Text style={styles.subsectionTitle}>11.3. Effect of Termination:{'\n'}</Text>
              Upon termination, your right to use the App will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability. We may retain certain information as required by law or for legitimate business purposes.
{'\n\n'}
              <Text style={styles.sectionTitle}>12. Governing Law and Dispute Resolution{'\n'}</Text>
              <Text style={styles.subsectionTitle}>12.1. Governing Law:{'\n'}</Text>
              These Terms shall be governed and construed in accordance with the laws of [Your State/Country], without regard to its conflict of law provisions.
{'\n\n'}
              <Text style={styles.subsectionTitle}>12.2. Binding Arbitration:{'\n'}</Text>
              Any dispute, controversy, or claim arising out of or relating to these Terms or the breach thereof shall be settled by binding arbitration administered by [Name of Arbitration Association, e.g., American Arbitration Association (AAA)] in accordance with its [Relevant Rules, e.g., Commercial Arbitration Rules], and judgment on the award rendered by the arbitrator(s) may be entered in any court having jurisdiction thereof. The arbitration will take place in [Your City, State/Country].
{'\n\n'}
              <Text style={styles.subsectionTitle}>12.3. Class Action Waiver:{'\n'}</Text>
              You agree that any arbitration or proceeding shall be limited to the dispute between us and you individually. To the full extent permitted by law, (a) no arbitration or proceeding shall be joined with any other; (b) there is no right or authority for any dispute to be arbitrated or resolved on a class-action basis or to utilize class action procedures; and (c) there is no right or authority for any dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.
{'\n\n'}
              <Text style={styles.sectionTitle}>13. Miscellaneous{'\n'}</Text>
              <Text style={styles.subsectionTitle}>13.1. Entire Agreement:{'\n'}</Text>
              These Terms, together with the Privacy Policy, constitute the entire agreement between you and LoveHour regarding your use of the App.
{'\n\n'}
              <Text style={styles.subsectionTitle}>13.2. Severability:{'\n'}</Text>
              If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions of these Terms will remain in full force and effect.
{'\n\n'}
              <Text style={styles.subsectionTitle}>13.3. Waiver:{'\n'}</Text>
              No waiver of any term or condition set forth in these Terms shall be deemed a further or continuing waiver of such term or condition or a waiver of any other term or condition, and any failure of LoveHour to assert a right or provision under these Terms shall not constitute a waiver of such right or provision.
{'\n\n'}
              <Text style={styles.subsectionTitle}>13.4. Assignment:{'\n'}</Text>
              You may not assign or transfer your rights or obligations under these Terms without our prior written consent. LoveHour may assign or transfer its rights and obligations under these Terms, in whole or in part, at any time without notice to you.
{'\n\n'}
              <Text style={styles.sectionTitle}>14. Contact Information{'\n'}</Text>
              If you have any questions about these Terms, please contact us at:
{'\n\n'}
              almazanroman888@gmail.com
            </Text>
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setAccepted(!accepted)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkboxBox, accepted && styles.checkboxBoxChecked]}>
                {accepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read and agree to the Terms of Service
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, (!accepted || loading) && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={!accepted || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Accept and Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  content: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  effectiveDate: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  termsContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxBoxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TermsOfServiceScreen;

