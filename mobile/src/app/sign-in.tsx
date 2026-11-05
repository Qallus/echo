import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
import { API_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

// Onboarding 2: sign in, or create an account (the same account as the
// website). New accounts confirm their email first, like on the web.
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [create, setCreate] = useState(params.mode === "create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (create && !name.trim()) return setError("Enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    const addr = email.trim();
    const { data, error: err } = create
      ? await supabase.auth.signUp({ email: addr, password, options: { data: { full_name: name.trim(), account_type: "personal" }, emailRedirectTo: `${API_URL}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email: addr, password });
    setBusy(false);
    if (err) return setError(err.message === "Invalid login credentials" ? "That email and password don't match." : err.message);
    if (create && !data.session) setSent(addr); // confirm the email, then sign in
  };

  if (sent) {
    return (
      <Screen>
        <Title>Check your email</Title>
        <Body>We sent a link to {sent}. Open it to confirm your account, then come back and sign in.</Body>
        <Button title="Sign in" onPress={() => { setSent(null); setCreate(false); }} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Title>{create ? "Create your account" : "Sign in"}</Title>
        <Body muted>{create ? "Free to start. The same account works on the web." : "Use your Redial or Echo account."}</Body>
        <View style={{ gap: 14 }}>
          {create && <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={create ? "new-password" : "current-password"} textContentType={create ? "newPassword" : "password"} onSubmitEditing={submit} />
          <ErrorText>{error}</ErrorText>
          <Button title={create ? "Create account" : "Sign in"} onPress={submit} busy={busy} />
          <Button title={create ? "I already have an account" : "Create an account"} variant="ghost" onPress={() => { setCreate(!create); setError(null); }} />
          {!create && <Button title="Forgot password?" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`)} />}
        </View>
        <View style={{ flex: 1 }} />
        <Button title="Back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
