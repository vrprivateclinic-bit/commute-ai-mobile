// screens/VoiceChatScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy"; // ✅ use legacy API to avoid deprecation crash
import { Ionicons } from "@expo/vector-icons";
import { Audio as AVAudio } from "expo-av";
import { Buffer } from "buffer"; // ✅ needed for base64 conversion

const BACKEND_URL = "https://commute-ai-backend.onrender.com";

export default function VoiceChatScreen() {
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  // 🎙️ Start recording
  const startRecording = async () => {
    try {
      console.log("🎤 Requesting microphone permissions...");
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("🎙️ Starting recording...");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      console.log("✅ Recording started");
    } catch (err) {
      console.error("❌ Failed to start recording:", err);
    }
  };

  // 🛑 Stop recording and send audio
  const stopRecording = async () => {
    console.log("🛑 Stopping recording...");
    if (!recording) {
      console.warn("⚠️ No active recording found");
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log("✅ Recording stopped. File stored at:", uri);

      // ✅ Use legacy API to safely check file info
      try {
        const info = await FileSystem.getInfoAsync(uri);
        console.log("📁 File info:", info);
      } catch (infoErr) {
        console.warn("⚠️ Could not get file info (not critical):", infoErr);
      }

      await sendAudio(uri);
    } catch (err) {
      console.error("❌ Error stopping recording:", err);
    } finally {
      setRecording(null);
    }
  };

  // 📤 Send audio to backend
  const sendAudio = async (uri) => {
    try {
      setLoading(true);
      console.log("🚀 Preparing FormData...");

      const fileType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

      const formData = new FormData();
      formData.append("audio", {
        uri,
        type: fileType,
        name: "recording.m4a",
      });

      console.log("📤 Sending request to:", `${BACKEND_URL}/talk`);

      const response = await fetch(`${BACKEND_URL}/talk`, {
        method: "POST",
        body: formData,
      });

      console.log("📥 Response status:", response.status);

      // ✅ Detect content type
      const contentType = response.headers.get("Content-Type") || "";
      console.log("📦 Content-Type:", contentType);

      if (contentType.includes("audio/")) {
        console.log("🔊 Received audio response directly — playing...");

        // ✅ Convert audio ArrayBuffer -> Base64 -> playable URI
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const audioUri = `data:audio/mpeg;base64,${base64}`;

        const { sound } = await AVAudio.Sound.createAsync({ uri: audioUri });
        await sound.playAsync();
        setReply("✅ Voice reply played");
      } else {
        // 🧪 Handle non-audio responses (errors, debug JSON, etc.)
        const text = await response.text();
        console.log("📦 Raw backend response:", text);
        try {
          const result = JSON.parse(text);
          if (result.error) {
            console.error("❌ Backend error:", result.error);
          }
          setTranscript(result.transcript || "");
          setReply(result.reply || "");
        } catch {
          console.warn("⚠️ Could not parse backend response:", text);
        }
      }
    } catch (err) {
      console.error("❌ Error sending audio:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎧 Commute AI</Text>

      <ScrollView style={styles.chatContainer}>
        {transcript ? (
          <View style={styles.bubbleUser}>
            <Text style={styles.bubbleText}>{transcript}</Text>
          </View>
        ) : null}

        {reply ? (
          <View style={styles.bubbleAI}>
            <Text style={styles.bubbleText}>{reply}</Text>
          </View>
        ) : null}
      </ScrollView>

      <TouchableOpacity
        style={[styles.micButton, recording ? styles.micRecording : null]}
        onPress={recording ? stopRecording : startRecording}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Ionicons
            name={recording ? "stop-circle" : "mic"}
            size={48}
            color="#fff"
          />
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        {recording ? "Listening... tap to stop" : "Tap to speak"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  chatContainer: { flex: 1, width: "100%" },
  bubbleUser: {
    backgroundColor: "#1e88e5",
    padding: 12,
    borderRadius: 16,
    alignSelf: "flex-end",
    marginVertical: 5,
    maxWidth: "80%",
  },
  bubbleAI: {
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginVertical: 5,
    maxWidth: "80%",
  },
  bubbleText: { color: "#fff", fontSize: 16 },
  micButton: {
    backgroundColor: "#e53935",
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  micRecording: { backgroundColor: "#43a047" },
  hint: { color: "#aaa", fontSize: 16 },
});
