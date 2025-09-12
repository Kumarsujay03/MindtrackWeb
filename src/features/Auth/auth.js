import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export async function signInWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return await signOut(auth);
}
