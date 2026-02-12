import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../supabase';
import { Logo } from './Logo';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState(1);

  // Body stats
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');

  // Nutrition goals
  const [calorieGoal, setCalorieGoal] = useState('2000');
  const [proteinGoal, setProteinGoal] = useState('150');
  const [carbsGoal, setCarbsGoal] = useState('250');
  const [fatGoal, setFatGoal] = useState('65');

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      if (data.session) {
        onAuthSuccess();
      }
    } catch (error: any) {
      Alert.alert('Sign In Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateStep1 = (): boolean => {
    if (!email || !password || !username.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!weight) {
      Alert.alert('Error', 'Please enter your current weight');
      return false;
    }
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 500) {
      Alert.alert('Error', 'Please enter a valid weight');
      return false;
    }
    if (height) {
      const h = parseFloat(height);
      if (isNaN(h) || h <= 0 || h > 300) {
        Alert.alert('Error', 'Please enter a valid height');
        return false;
      }
    }
    if (age) {
      const a = parseInt(age);
      if (isNaN(a) || a < 13 || a > 120) {
        Alert.alert('Error', 'Please enter a valid age (13-120)');
        return false;
      }
    }
    if (!gender) {
      Alert.alert('Error', 'Please select your gender');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const cal = parseFloat(calorieGoal);
    const prot = parseFloat(proteinGoal);
    const carb = parseFloat(carbsGoal);
    const f = parseFloat(fatGoal);
    if (isNaN(cal) || cal <= 0) {
      Alert.alert('Error', 'Please enter a valid calorie goal');
      return false;
    }
    if (isNaN(prot) || prot < 0) {
      Alert.alert('Error', 'Please enter a valid protein goal');
      return false;
    }
    if (isNaN(carb) || carb < 0) {
      Alert.alert('Error', 'Please enter a valid carbs goal');
      return false;
    }
    if (isNaN(f) || f < 0) {
      Alert.alert('Error', 'Please enter a valid fat goal');
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (signUpStep === 1) {
      if (!validateStep1()) return;

      setLoading(true);
      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', username.trim())
          .limit(1);

        if (existing && existing.length > 0) {
          Alert.alert('Error', 'Username is already taken');
          return;
        }
        setSignUpStep(2);
      } catch (error: any) {
        Alert.alert('Error', error.message);
      } finally {
        setLoading(false);
      }
    } else if (signUpStep === 2) {
      if (!validateStep2()) return;
      setSignUpStep(3);
    }
  };

  const handleSignUp = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            username: username.trim(),
            starting_weight: parseFloat(weight),
            height: parseFloat(height) || null,
            age: age ? parseInt(age) : null,
            gender: gender || null,
            calorie_goal: parseFloat(calorieGoal),
            protein_goal: parseFloat(proteinGoal),
            carbs_goal: parseFloat(carbsGoal),
            fat_goal: parseFloat(fatGoal),
          },
        },
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Account created! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => { setIsSignUp(false); setSignUpStep(1); } }]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <View style={[styles.stepDot, signUpStep >= step && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, signUpStep >= step && styles.stepDotTextActive]}>
              {step}
            </Text>
          </View>
          {step < 3 && (
            <View style={[styles.stepLine, signUpStep > step && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderSignUpStep1 = () => (
    <>
      <Text style={styles.stepTitle}>Create Account</Text>
      <Text style={styles.stepSubtitle}>Enter your account details</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
        maxLength={20}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={colors.textMuted}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleNextStep}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Checking...' : 'Next'}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderSignUpStep2 = () => (
    <>
      <Text style={styles.stepTitle}>Body Stats</Text>
      <Text style={styles.stepSubtitle}>Help us personalize your experience</Text>

      <Text style={styles.fieldLabel}>Current Weight (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 75"
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Height (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 175"
        value={height}
        onChangeText={setHeight}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Age</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 25"
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={styles.genderRow}>
        <TouchableOpacity
          style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
          onPress={() => setGender('male')}
        >
          <Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextActive]}>
            Male
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
          onPress={() => setGender('female')}
        >
          <Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextActive]}>
            Female
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSignUpStep(1)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.nextButton]}
          onPress={handleNextStep}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignUpStep3 = () => (
    <>
      <Text style={styles.stepTitle}>Nutrition Goals</Text>
      <Text style={styles.stepSubtitle}>Set your daily nutrition targets</Text>

      <Text style={styles.fieldLabel}>Daily Calories</Text>
      <TextInput
        style={styles.input}
        placeholder="2000"
        value={calorieGoal}
        onChangeText={setCalorieGoal}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Protein (g)</Text>
      <TextInput
        style={styles.input}
        placeholder="150"
        value={proteinGoal}
        onChangeText={setProteinGoal}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Carbs (g)</Text>
      <TextInput
        style={styles.input}
        placeholder="250"
        value={carbsGoal}
        onChangeText={setCarbsGoal}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Fat (g)</Text>
      <TextInput
        style={styles.input}
        placeholder="65"
        value={fatGoal}
        onChangeText={setFatGoal}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSignUpStep(2)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.nextButton, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Sign-in view
  if (!isSignUp) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Logo size={s(80)} />
          </View>
          <Text style={styles.logo}>Momentum</Text>
          <Text style={styles.tagline}>Track your fitness journey</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Loading...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(true)}
            >
              <Text style={styles.switchButtonText}>
                Don't have an account? Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Sign-up multi-step view
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Logo size={s(50)} />
        </View>
        <Text style={styles.logoSmall}>Momentum</Text>

        {renderStepIndicator()}

        <View style={styles.form}>
          {signUpStep === 1 && renderSignUpStep1()}
          {signUpStep === 2 && renderSignUpStep2()}
          {signUpStep === 3 && renderSignUpStep3()}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => { setIsSignUp(false); setSignUpStep(1); }}
          >
            <Text style={styles.switchButtonText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: s(32),
    paddingVertical: s(40),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: s(16),
  },
  logo: {
    fontSize: s(42),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    textAlign: 'center',
    marginBottom: s(8),
    letterSpacing: s(-0.5),
  },
  logoSmall: {
    fontSize: s(28),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    textAlign: 'center',
    marginBottom: s(8),
    letterSpacing: s(-0.5),
  },
  tagline: {
    fontSize: s(15),
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: s(48),
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(16),
    fontSize: s(16),
    color: c.text,
    marginBottom: s(16),
    borderWidth: s(1),
    borderColor: c.border,
  },
  button: {
    backgroundColor: c.accent,
    borderRadius: s(12),
    padding: s(18),
    alignItems: 'center',
    marginTop: s(8),
  },
  buttonDisabled: {
    backgroundColor: c.border,
  },
  buttonText: {
    color: '#fff',
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
  },
  switchButton: {
    marginTop: s(24),
    alignItems: 'center',
  },
  switchButtonText: {
    color: c.accent,
    fontSize: s(14),
  },
  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(32),
  },
  stepDot: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.card,
    borderWidth: s(2),
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  stepDotText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLine: {
    width: s(40),
    height: s(2),
    backgroundColor: c.border,
    marginHorizontal: s(4),
  },
  stepLineActive: {
    backgroundColor: c.accent,
  },
  // Step content
  stepTitle: {
    fontSize: s(24),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginBottom: s(6),
  },
  stepSubtitle: {
    fontSize: s(14),
    color: c.textMuted,
    marginBottom: s(24),
  },
  fieldLabel: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
    marginBottom: s(6),
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
  },
  // Gender selector
  genderRow: {
    flexDirection: 'row',
    gap: s(12),
    marginBottom: s(16),
  },
  genderButton: {
    flex: 1,
    paddingVertical: s(14),
    borderRadius: s(12),
    borderWidth: s(1),
    borderColor: c.border,
    backgroundColor: c.card,
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: c.accent,
    backgroundColor: '#0F2A4A',
  },
  genderButtonText: {
    fontSize: s(16),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  genderButtonTextActive: {
    color: c.accent,
  },
  // Navigation buttons
  buttonRow: {
    flexDirection: 'row',
    gap: s(12),
    marginTop: s(8),
  },
  backButton: {
    flex: 1,
    paddingVertical: s(18),
    borderRadius: s(12),
    borderWidth: s(1),
    borderColor: c.border,
    alignItems: 'center',
  },
  backButtonText: {
    color: c.textSecondary,
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
  },
  nextButton: {
    flex: 2,
  },
});
