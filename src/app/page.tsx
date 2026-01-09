"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    CheckCircle2, Plus, Trash2, BookOpen, Activity, AlertCircle,
    CalendarDays, Clock, ChevronDown, ChevronUp, Settings, RefreshCcw,
    User, GraduationCap, School, LogOut, Loader2, Key,
    ChevronLeft, ChevronRight, Calendar, AlertTriangle, X, Save, Palette, Image as ImageIcon
} from 'lucide-react';

// Import Firebase
import { auth, db } from '@/lib/firebase';
import {
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    User as FirebaseUser
} from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    addDoc,
    deleteDoc,
    updateDoc,
    onSnapshot,
    query,
    orderBy
} from 'firebase/firestore';

// --- CONSTANTES THEMES ---
const THEMES: Record<string, { [key: number]: string }> = {
    indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 900: '#312e81' },
    emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b' },
    blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a' },
    violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#4c1d95' },
    rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 900: '#881337' },
    amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 900: '#78350f' },
    cyan: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 900: '#164e63' },
    fuchsia: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 900: '#701a75' },
    teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 900: '#134e4a' },
    slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 500: '#64748b', 600: '#475569', 700: '#334155', 900: '#0f172a' },
};

const THEME_NAMES: Record<string, string> = {
    indigo: 'Indigo', emerald: 'Émeraude', blue: 'Océan', violet: 'Violet',
    rose: 'Rose', amber: 'Ambre', cyan: 'Cyan', fuchsia: 'Fuchsia',
    teal: 'Turquoise', slate: 'Ardoise'
};

// --- CONSTANTES WALLPAPERS ---
const WALLPAPERS = [
    { id: 'none', name: 'Neutre', url: '' },
    { id: 'Fuji', name: 'Mont Fuji', url: '/wallpapers/Mont_Fuji.jpg'},
    { id: 'Waves', name: 'Vague de kanagawa', url: '/wallpapers/Vagues.jpg'},
    { id: 'Naples', name: 'Naples 1780', url: '/wallpapers/Naples_1780.jpg'},
    { id: 'Japan', name: 'Art Japonais', url: '/wallpapers/Poète_japonais.jpg'},
    { id: 'abstract', name: 'Abstrait', url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=2560&ixlib=rb-4.0.3' },
    { id: 'geometric', name: 'Géométrique', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=2560&ixlib=rb-4.0.3' },
];

// --- TYPES ---
type Review = {
    jKey: string;
    date: string;
    done: boolean;
    interval: number;
};

type Semester = 'S1' | 'S2';
type CourseType = 'PASS' | 'LAS' | 'PACES' | 'Autre';

type UserProfile = {
    firstName: string;
    lastName: string;
    university: string;
    courseType: CourseType;
    currentSemester: Semester;
    theme?: string;
    wallpaper?: string;
};

type Course = {
    id: string;
    name: string;
    subject: string;
    startDate: string;
    reviews: Review[];
    progress: number;
    semester: Semester;
};

type Tab = 'planning' | 'all' | 'add' | 'profile';

const DEFAULT_INTERVALS = [0, 1, 3, 7, 14, 30, 60];
const AVAILABLE_OPTS = [0, 1, 2, 3, 4, 5, 7, 10, 14, 15, 20, 21, 28, 30, 42, 45, 60];

const UNIVERSITY_SUGGESTIONS = [
    "Université Paris Cité", "Sorbonne Université", "Université Paris-Saclay",
    "Université Paris-Est Créteil", "UFR Simone Veil - UVSQ", "Aix-Marseille Université",
    "Université Claude Bernard Lyon 1", "Université de Montpellier", "Université Grenoble Alpes",
    "Université Côte d’Azur (Nice)", "Université de Lille", "Université de Bordeaux",
    "Université de Toulouse", "Université de Strasbourg", "Université de Rennes 1"
];

// --- UTILITAIRES DATES ---
const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

export default function Home() {
    // --- ETATS ---
    const [user, setUser] = useState<FirebaseUser | null>(null);

    const [loadingAuth, setLoadingAuth] = useState(true);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [envError, setEnvError] = useState(false);

    const [courses, setCourses] = useState<Course[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    const [showProfileModal, setShowProfileModal] = useState(false);

    const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
    const [alertInfo, setAlertInfo] = useState<{title: string, message: string, type: 'error' | 'info'} | null>(null);

    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseSubject, setNewCourseSubject] = useState('');
    const [learningDate, setLearningDate] = useState('');

    const [planningStartDate, setPlanningStartDate] = useState<Date>(() => {
        return getStartOfWeek(new Date());
    });

    const [tempProfile, setTempProfile] = useState<UserProfile>({
        firstName: '', lastName: '', university: '', courseType: 'PASS', currentSemester: 'S1', theme: 'indigo', wallpaper: ''
    });

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customIntervals, setCustomIntervals] = useState<number[]>(DEFAULT_INTERVALS);
    const [activeTab, setActiveTab] = useState<Tab>('planning');
    const [showOverdue, setShowOverdue] = useState(true);

    // --- LOGIQUE THEMES & WALLPAPER ---
    const activeTheme = activeTab === 'profile' ? tempProfile.theme || 'indigo' : userProfile?.theme || 'indigo';
    const themeColors = THEMES[activeTheme] || THEMES['indigo'];

    // Gestion du fond d'écran
    const activeWallpaperUrl = activeTab === 'profile'
        ? (tempProfile.wallpaper || '')
        : (userProfile?.wallpaper || '');

    const dynamicStyle = {
        '--theme-50': themeColors[50],
        '--theme-100': themeColors[100],
        '--theme-200': themeColors[200],
        '--theme-300': themeColors[300],
        '--theme-500': themeColors[500],
        '--theme-600': themeColors[600],
        '--theme-700': themeColors[700],
        '--theme-900': themeColors[900],
        backgroundImage: activeWallpaperUrl ? `url(${activeWallpaperUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    } as React.CSSProperties;

    // Fonction pour obtenir une couleur unique par cours
    const getCourseColor = (courseId: string) => {
        const availableThemes = Object.keys(THEMES).filter(t => t !== activeTheme);
        let hash = 0;
        for (let i = 0; i < courseId.length; i++) {
            hash = courseId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % availableThemes.length;
        const themeKey = availableThemes[index];
        return THEMES[themeKey];
    };

    // --- 1. GESTION AUTHENTIFICATION & CHARGEMENT DONNÉES ---
    useEffect(() => {
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
            setEnvError(true);
            setLoadingAuth(false);
            return;
        }

        setLearningDate(new Date().toISOString().split('T')[0]);

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);

            if (currentUser) {
                setLoadingProfile(true);

                const profileRef = doc(db, 'users', currentUser.uid);
                const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data() as UserProfile;
                        setUserProfile(data);
                        setTempProfile(data);
                        setShowProfileModal(false);
                    } else {
                        setUserProfile(null);
                        setShowProfileModal(true);
                    }
                    setLoadingProfile(false);
                }, (error) => {
                    console.error("Erreur lecture profil:", error);
                    setLoadingProfile(false);
                });

                const coursesRef = collection(db, 'users', currentUser.uid, 'courses');
                const q = query(coursesRef, orderBy('startDate', 'desc'));
                const unsubscribeCourses = onSnapshot(q, (snapshot) => {
                    const coursesData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Course[];
                    setCourses(coursesData);
                });

                return () => {
                    unsubscribeProfile();
                    unsubscribeCourses();
                };
            } else {
                setCourses([]);
                setUserProfile(null);
                setLoadingProfile(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // --- ACTIONS ---

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            console.error("Erreur de connexion", error);
            if (error.code === 'auth/configuration-not-found' || error.code === 'auth/api-key-not-valid-please-pass-a-valid-api-key') {
                setEnvError(true);
            } else {
                setAlertInfo({ title: "Erreur de connexion", message: error.message, type: 'error' });
            }
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setUserProfile(null);
        setShowProfileModal(false);
        setActiveTab('planning');
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !tempProfile.firstName.trim()) return;

        setIsSaving(true);

        try {
            await setDoc(doc(db, 'users', user.uid), tempProfile);
            setAlertInfo({ title: "Succès", message: "Vos informations ont été mises à jour.", type: 'info' });
        } catch (error) {
            console.error("Erreur sauvegarde profil", error);
            setAlertInfo({ title: "Erreur", message: "Impossible de sauvegarder le profil.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const switchSemester = async () => {
        if (!user || !userProfile) return;
        const newSem = userProfile.currentSemester === 'S1' ? 'S2' : 'S1';
        setUserProfile({ ...userProfile, currentSemester: newSem });
        await updateDoc(doc(db, 'users', user.uid), { currentSemester: newSem });
    };

    const addDays = (dateString: string, days: number): Date => {
        const result = new Date(dateString);
        result.setDate(result.getDate() + days);
        return result;
    };

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newCourseName.trim() || !newCourseSubject.trim()) return;

        const intervalsToUse = showAdvanced ? customIntervals : DEFAULT_INTERVALS;
        if (intervalsToUse.length === 0) {
            setAlertInfo({ title: "Attention", message: "Vous devez sélectionner au moins un intervalle de révision (J) pour créer un cours.", type: 'info' });
            return;
        }

        const reviews: Review[] = intervalsToUse.map((interval) => ({
            jKey: `J${interval}`,
            date: addDays(learningDate, interval).toISOString(),
            done: false,
            interval: interval
        }));

        const newCourseData = {
            name: newCourseName,
            subject: newCourseSubject,
            startDate: learningDate,
            reviews: reviews,
            progress: 0,
            semester: userProfile ? userProfile.currentSemester : 'S1'
        };

        try {
            await addDoc(collection(db, 'users', user.uid, 'courses'), newCourseData);
            setNewCourseName('');
            setNewCourseSubject('');
            setActiveTab('planning');
        } catch (error) {
            console.error("Erreur ajout cours", error);
            setAlertInfo({ title: "Erreur", message: "Impossible de créer le cours.", type: 'error' });
        }
    };

    const toggleReview = async (courseId: string, jKey: string) => {
        if (!user) return;
        const courseToUpdate = courses.find(c => c.id === courseId);
        if (!courseToUpdate) return;

        const updatedReviews = courseToUpdate.reviews.map(review =>
            review.jKey === jKey ? { ...review, done: !review.done } : review
        );

        const doneCount = updatedReviews.filter(r => r.done).length;
        const progress = Math.round((doneCount / updatedReviews.length) * 100);

        const courseRef = doc(db, 'users', user.uid, 'courses', courseId);
        await updateDoc(courseRef, { reviews: updatedReviews, progress: progress });
    };

    const requestDeleteCourse = (id: string) => {
        setCourseToDelete(id);
    };

    const confirmDeleteCourse = async () => {
        if (!user || !courseToDelete) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'courses', courseToDelete));
            setCourseToDelete(null);
        } catch (error) {
            console.error("Erreur suppression", error);
            setAlertInfo({ title: "Erreur", message: "Impossible de supprimer ce cours.", type: 'error' });
        }
    };

    const toggleCustomInterval = (val: number) => {
        setCustomIntervals(prev => prev.includes(val) ? prev.filter(i => i !== val) : [...prev, val].sort((a, b) => a - b));
    };

    // --- NAVIGATION PLANNING ---
    const handlePrevWeek = () => {
        const newDate = new Date(planningStartDate);
        newDate.setDate(newDate.getDate() - 7);
        setPlanningStartDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(planningStartDate);
        newDate.setDate(newDate.getDate() + 7);
        setPlanningStartDate(newDate);
    };

    const handleResetToday = () => {
        setPlanningStartDate(getStartOfWeek(new Date()));
    };

    // --- FILTRES & HELPERS ---
    const currentSemesterCourses = courses.filter(c => {
        if (!userProfile) return true;
        return !c.semester || c.semester === userProfile.currentSemester;
    });

    const getTasksForDate = (targetDate: Date) => {
        const tasks: any[] = [];
        currentSemesterCourses.forEach(course => {
            course.reviews.forEach(review => {
                const rDate = new Date(review.date);
                if (rDate.toDateString() === targetDate.toDateString()) {
                    tasks.push({ ...review, courseName: course.name, courseSubject: course.subject, courseId: course.id });
                }
            });
        });
        return tasks;
    };

    const getOverdueTasks = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tasks: any[] = [];
        currentSemesterCourses.forEach(course => {
            course.reviews.forEach(review => {
                const rDate = new Date(review.date);
                rDate.setHours(0,0,0,0);
                if (!review.done && rDate < today) {
                    tasks.push({ ...review, courseName: course.name, courseSubject: course.subject, courseId: course.id });
                }
            });
        });
        return tasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    const generateNext7Days = () => {
        const days = [];
        const start = new Date(planningStartDate);
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const isActuallyToday = (d: Date) => {
        const today = new Date();
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    };

    const getDayLabel = (date: Date) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const d = new Date(date);
        d.setHours(0,0,0,0);

        const diffTime = d.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Aujourd'hui";
        if (diffDays === 1) return "Demain";
        return date.toLocaleDateString('fr-FR', { weekday: 'long' });
    };

    const overdueTasks = getOverdueTasks();
    const next7Days = generateNext7Days();

    // --- RENDU ---

    // 1. Erreur Config
    if (envError) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full p-8 rounded-2xl shadow-xl border-l-4 border-rose-500">
                <h1 className="text-xl font-bold text-slate-800 mb-2">Configuration Manquante</h1>
                <p className="text-slate-600 mb-4">Le fichier .env.local est introuvable ou incomplet.</p>
                <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Recharger</button>
            </div>
        </div>
    );

    // 2. Chargement initial
    if (loadingAuth || (user && loadingProfile)) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
            <Loader2 className="w-10 h-10 text-[var(--theme-600)] animate-spin" style={{ color: themeColors[600] }} />
            <p className="text-slate-500 font-medium animate-pulse">
                {loadingAuth ? 'Connexion en cours...' : 'Récupération de votre profil...'}
            </p>
        </div>
    );

    // 3. Login
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[var(--theme-50)] to-white flex items-center justify-center p-4" style={dynamicStyle}>
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-fade-in">
                    <div className="bg-[var(--theme-100)] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Activity className="w-10 h-10 text-[var(--theme-600)]" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Med&J</h1>
                    <p className="text-slate-500 mb-8">La méthode des J automatisée pour réussir vos études de santé.</p>
                    <button onClick={handleLogin} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3">
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" /> Continuer avec Google
                    </button>
                </div>
            </div>
        );
    }

    // 4. Modale Profil (ONBOARDING)
    if (showProfileModal) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" style={dynamicStyle}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up-fade">
                    <div className="bg-[var(--theme-600)] p-6 text-white text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold">Bienvenue !</h2>
                        <p className="text-indigo-100 text-sm mt-1">Configurez votre profil étudiant pour commencer</p>
                    </div>

                    <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prénom</label>
                                <input type="text" required className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--theme-500)] outline-none" value={tempProfile.firstName} onChange={(e) => setTempProfile({...tempProfile, firstName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
                                <input type="text" required className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--theme-500)] outline-none" value={tempProfile.lastName} onChange={(e) => setTempProfile({...tempProfile, lastName: e.target.value})} />
                            </div>
                        </div>
                        {/* ... Reste du formulaire simplifié ... */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cursus</label>
                                <select className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--theme-500)] outline-none bg-white" value={tempProfile.courseType} onChange={(e) => setTempProfile({...tempProfile, courseType: e.target.value as CourseType})}>
                                    <option value="PASS">PASS</option><option value="LAS">LAS</option><option value="PACES">PACES</option><option value="Autre">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semestre</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setTempProfile({...tempProfile, currentSemester: 'S1'})} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${tempProfile.currentSemester === 'S1' ? 'bg-[var(--theme-600)] text-white' : 'bg-white text-slate-400'}`}>S1</button>
                                    <button type="button" onClick={() => setTempProfile({...tempProfile, currentSemester: 'S2'})} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${tempProfile.currentSemester === 'S2' ? 'bg-[var(--theme-600)] text-white' : 'bg-white text-slate-400'}`}>S2</button>
                                </div>
                            </div>
                        </div>
                        <button type="submit" disabled={isSaving} className="w-full bg-[var(--theme-600)] hover:bg-[var(--theme-700)] text-white font-bold py-3 rounded-xl mt-4 flex justify-center">
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Commencer l\'aventure'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 5. App Principale
    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans selection:bg-[var(--theme-100)] relative flex flex-col" style={dynamicStyle}>

            {/* Overlay pour la lisibilité */}
            {activeWallpaperUrl && <div className="absolute inset-0 bg-white/80 z-0 pointer-events-none backdrop-blur-[2px]"></div>}

            {/* HEADER */}
            <header className="bg-white/90 border-b border-slate-200 z-20 shadow-sm/50 backdrop-blur-md flex-none">
                <div className="max-w-[95%] mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--theme-600)] p-2 rounded-lg shadow-sm">
                            <Activity className="text-white w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg leading-none text-[var(--theme-900)]">Med&J</span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {userProfile?.courseType} • {userProfile?.university}
              </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {userProfile && (userProfile.courseType === 'PASS' || userProfile.courseType === 'LAS') && (
                            <button onClick={switchSemester} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-[var(--theme-50)] hover:text-[var(--theme-600)] rounded-full border border-slate-200 transition-all group">
                                <span className={`text-xs font-bold ${userProfile.currentSemester === 'S1' ? 'text-[var(--theme-600)]' : 'text-slate-400'}`}>S1</span>
                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${userProfile.currentSemester === 'S2' ? 'bg-[var(--theme-500)]' : 'bg-slate-300'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${userProfile.currentSemester === 'S2' ? 'translate-x-4' : ''}`} />
                                </div>
                                <span className={`text-xs font-bold ${userProfile.currentSemester === 'S2' ? 'text-[var(--theme-600)]' : 'text-slate-400'}`}>S2</span>
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${activeTab === 'profile' ? 'bg-[var(--theme-600)] text-white border-[var(--theme-600)]' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-[var(--theme-50)] hover:text-[var(--theme-600)]'}`}
                        >
                            <User className="w-5 h-5" />
                        </button>
                        <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600 transition-colors" title="Déconnexion"><LogOut className="w-5 h-5" /></button>
                    </div>
                </div>
            </header>

            {/* CONTENU */}
            <main className="flex-1 overflow-y-auto scrollbar-hide max-w-[95%] w-full mx-auto px-4 py-6 pb-24 z-10">
                <div className="mb-6 animate-fade-in flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {activeTab === 'profile' ? 'Mon Profil' : `Bonjour, ${userProfile?.firstName} 👋`}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {activeTab === 'profile' ? 'Gérez vos informations personnelles et votre thème.' : `Programme pour le ${userProfile?.currentSemester}.`}
                        </p>
                    </div>
                </div>

                {/* TABS (Cachés si profil) */}
                {activeTab !== 'profile' && (
                    <div className="flex gap-2 mb-8 bg-white/90 p-1.5 rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto backdrop-blur-sm">
                        <button onClick={() => setActiveTab('planning')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'planning' ? 'bg-[var(--theme-50)] text-[var(--theme-700)] shadow-sm ring-1 ring-[var(--theme-200)]' : 'text-slate-500 hover:bg-slate-50'}`}><CalendarDays className="w-4 h-4" />Planning</button>
                        <button onClick={() => setActiveTab('all')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'all' ? 'bg-[var(--theme-50)] text-[var(--theme-700)] shadow-sm ring-1 ring-[var(--theme-200)]' : 'text-slate-500 hover:bg-slate-50'}`}><BookOpen className="w-4 h-4" />Cours</button>
                        <button onClick={() => setActiveTab('add')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'add' ? 'bg-[var(--theme-50)] text-[var(--theme-700)] shadow-sm ring-1 ring-[var(--theme-200)]' : 'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-4 h-4" />Ajouter</button>
                    </div>
                )}

                {/* --- VUE: PROFIL (AVEC THEMES & WALLPAPERS) --- */}
                {activeTab === 'profile' && (
                    <div className="max-w-2xl mx-auto animate-slide-up-fade">
                        <button
                            onClick={() => setActiveTab('planning')}
                            className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[var(--theme-600)] transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Retour au planning
                        </button>

                        <div className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 overflow-hidden backdrop-blur-sm">
                            <div className="bg-slate-50/80 p-6 border-b border-slate-100 flex items-center gap-4">
                                <div className="w-16 h-16 bg-[var(--theme-100)] rounded-full flex items-center justify-center">
                                    <GraduationCap className="w-8 h-8 text-[var(--theme-600)]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Mes Préférences</h2>
                                    <p className="text-slate-500 text-sm">Modifiez vos informations et l'apparence.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveProfile} className="p-8 space-y-8">
                                {/* SELECTEUR DE THEME */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                                        <Palette className="w-4 h-4" /> Thème de couleur
                                    </label>
                                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                                        {Object.keys(THEMES).map((themeKey) => (
                                            <button
                                                key={themeKey}
                                                type="button"
                                                onClick={() => setTempProfile({ ...tempProfile, theme: themeKey })}
                                                className={`
                                            w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
                                            ${tempProfile.theme === themeKey ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}
                                        `}
                                                style={{ backgroundColor: THEMES[themeKey][500] }}
                                                title={THEME_NAMES[themeKey]}
                                            >
                                                {tempProfile.theme === themeKey && <CheckCircle2 className="w-6 h-6 text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                {/* SELECTEUR DE WALLPAPER */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4" /> Fond d'écran
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
                                        {WALLPAPERS.map((wp) => (
                                            <div
                                                key={wp.id}
                                                onClick={() => setTempProfile({ ...tempProfile, wallpaper: wp.url })}
                                                className={`
                                            relative h-24 rounded-t-xl cursor-pointer overflow-hidden border-2 transition-all group
                                            ${(tempProfile.wallpaper === wp.url || (!tempProfile.wallpaper && wp.id === 'none'))
                                                    ? 'border-[var(--theme-600)] ring-2 ring-[var(--theme-200)]'
                                                    : 'border-transparent hover:border-slate-300'}
                                        `}
                                            >
                                                {wp.url ? (
                                                    <img src={wp.url} alt={wp.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-medium">Aucun</div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                                                {/* Badge nom */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-white/90 py-1 px-2 text-[10px] font-bold text-center text-slate-600 backdrop-blur-sm">
                                                    {wp.name}
                                                </div>

                                                {/* Icone sélection */}
                                                {(tempProfile.wallpaper === wp.url || (!tempProfile.wallpaper && wp.id === 'none')) && (
                                                    <div className="absolute top-1 right-1 bg-[var(--theme-600)] rounded-full p-0.5">
                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                {/* INFOS PERSO */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Prénom</label>
                                        <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[var(--theme-500)] outline-none transition-all focus:ring-2 focus:ring-[var(--theme-100)]" value={tempProfile.firstName} onChange={(e) => setTempProfile({...tempProfile, firstName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Nom</label>
                                        <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[var(--theme-500)] outline-none transition-all focus:ring-2 focus:ring-[var(--theme-100)]" value={tempProfile.lastName} onChange={(e) => setTempProfile({...tempProfile, lastName: e.target.value})} />
                                    </div>
                                </div>

                                {/* ... (Reste du formulaire Profil) ... */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2"><School className="w-4 h-4" /> Université</label>
                                    <input type="text" required list="university-suggestions" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[var(--theme-500)] outline-none transition-all focus:ring-2 focus:ring-[var(--theme-100)]" value={tempProfile.university} onChange={(e) => setTempProfile({...tempProfile, university: e.target.value})} />
                                    <datalist id="university-suggestions">{UNIVERSITY_SUGGESTIONS.map((uni) => (<option key={uni} value={uni} />))}</datalist>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Cursus</label>
                                        <div className="relative">
                                            <select className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[var(--theme-500)] outline-none appearance-none bg-white transition-all focus:ring-2 focus:ring-[var(--theme-100)]" value={tempProfile.courseType} onChange={(e) => setTempProfile({...tempProfile, courseType: e.target.value as CourseType})}>
                                                <option value="PASS">PASS</option><option value="LAS">LAS</option><option value="PACES">PACES</option><option value="Autre">Autre</option>
                                            </select>
                                            <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Semestre Actuel</label>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => setTempProfile({...tempProfile, currentSemester: 'S1'})} className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${tempProfile.currentSemester === 'S1' ? 'bg-[var(--theme-600)] text-white border-[var(--theme-600)] shadow-md shadow-[var(--theme-200)]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>S1</button>
                                            <button type="button" onClick={() => setTempProfile({...tempProfile, currentSemester: 'S2'})} className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${tempProfile.currentSemester === 'S2' ? 'bg-[var(--theme-600)] text-white border-[var(--theme-600)] shadow-md shadow-[var(--theme-200)]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>S2</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex justify-end">
                                    <button type="submit" disabled={isSaving} className="bg-[var(--theme-600)] hover:bg-[var(--theme-700)] text-white font-bold py-3 px-8 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-[var(--theme-200)] disabled:opacity-70 disabled:cursor-not-allowed">
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Enregistrer</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* VUE: AJOUTER */}
                {activeTab === 'add' && (
                    <div className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-6 max-w-xl mx-auto animate-slide-up-fade backdrop-blur-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100"><Plus className="w-5 h-5 text-[var(--theme-600)]" />Nouveau cours</h2>
                        <form onSubmit={handleAddCourse} className="space-y-5">
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Matière</label><input type="text" placeholder="Ex: Anatomie..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[var(--theme-500)] outline-none" value={newCourseSubject} onChange={(e) => setNewCourseSubject(e.target.value)} /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Titre du cours</label><input type="text" placeholder="Ex: Le squelette..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[var(--theme-500)] outline-none" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Appris le (J0)</label><input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600" value={learningDate} onChange={(e) => setLearningDate(e.target.value)} /></div>
                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[var(--theme-600)]"><Settings className="w-4 h-4" />{showAdvanced ? 'Masquer' : 'Personnaliser (J)'}{showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
                                {showAdvanced && (<div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100"><div className="flex justify-between mb-3"><span className="text-xs font-bold text-slate-500 uppercase">Fréquence</span><button type="button" onClick={() => setCustomIntervals(DEFAULT_INTERVALS)} className="text-[10px] bg-white border px-2 py-1 rounded"><RefreshCcw className="w-3 h-3 inline mr-1" />Reset</button></div><div className="grid grid-cols-6 sm:grid-cols-8 gap-2">{AVAILABLE_OPTS.map(j => (<button key={j} type="button" onClick={() => toggleCustomInterval(j)} className={`h-9 rounded-lg text-sm font-bold border ${customIntervals.includes(j) ? 'bg-[var(--theme-600)] text-white' : 'bg-white text-slate-400'}`}>J{j}</button>))}</div></div>)}
                            </div>
                            <button type="submit" className="w-full bg-[var(--theme-600)] hover:bg-[var(--theme-700)] text-white font-bold py-4 rounded-xl mt-2">Générer le planning</button>
                        </form>
                    </div>
                )}

                {/* VUE: PLANNING */}
                {activeTab === 'planning' && (
                    <div className="space-y-6 animate-slide-up-fade">

                        {/* Contrôles de navigation */}
                        <div className="flex items-center justify-between bg-white/90 p-2 rounded-2xl shadow-sm border border-slate-200 mb-4 sticky top-0 z-10 backdrop-blur-sm">
                            <button
                                onClick={handlePrevWeek}
                                className="p-3 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                                title="Semaine précédente"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex flex-col items-center">
                                {(() => {
                                    const end = new Date(planningStartDate);
                                    end.setDate(end.getDate() + 6);
                                    const weekNum = getWeekNumber(planningStartDate);
                                    const startMonth = planningStartDate.toLocaleDateString('fr-FR', { month: 'long' });
                                    const endMonth = end.toLocaleDateString('fr-FR', { month: 'long' });

                                    return (
                                        <>
                                            <span className="text-xs font-bold text-[var(--theme-500)] uppercase tracking-widest mb-0.5">Semaine {weekNum}</span>
                                            <span className="text-sm font-bold text-slate-800 capitalize">
                                  {planningStartDate.getDate()} {startMonth === endMonth ? '' : startMonth} - {end.getDate()} {endMonth}
                              </span>
                                        </>
                                    )
                                })()}

                                {planningStartDate.getTime() !== getStartOfWeek(new Date()).getTime() && (
                                    <button
                                        onClick={handleResetToday}
                                        className="text-[10px] font-bold text-slate-400 hover:text-[var(--theme-600)] mt-1 flex items-center gap-1 transition-colors"
                                    >
                                        <RefreshCcw className="w-3 h-3" />
                                        Revenir à aujourd'hui
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleNextWeek}
                                className="p-3 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                                title="Semaine suivante"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Retard */}
                        {overdueTasks.length > 0 && (
                            <div className="bg-rose-50/95 border border-rose-100 rounded-2xl overflow-hidden shadow-sm max-w-4xl mx-auto backdrop-blur-sm">
                                <button onClick={() => setShowOverdue(!showOverdue)} className="w-full px-5 py-3 flex items-center justify-between bg-rose-100/50 text-rose-700 font-bold"><div className="flex items-center gap-2"><AlertCircle className="w-5 h-5" /><span>En Retard ({overdueTasks.length})</span></div>{showOverdue ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                                {showOverdue && (<div className="p-2 grid gap-2 sm:grid-cols-2">{overdueTasks.map((task) => {
                                    const courseColor = getCourseColor(task.courseId);
                                    return (
                                        <div key={`${task.courseId}-${task.jKey}`} className="bg-white p-3 rounded-xl border-l-4 shadow-sm flex justify-between items-center" style={{borderLeftColor: courseColor[500]}}>
                                            <div className="min-w-0 flex-1 pr-3">
                                                <div className="flex gap-2 mb-1">
                                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{backgroundColor: courseColor[50], color: courseColor[700]}}>{task.jKey}</span>
                                                    <span className="text-xs text-slate-400 truncate">{task.courseSubject}</span>
                                                </div>
                                                <h3 className="font-semibold text-slate-800 text-sm truncate">{task.courseName}</h3>
                                            </div>
                                            <button
                                                onClick={() => toggleReview(task.courseId, task.jKey)}
                                                className="w-10 h-10 rounded-full hover:text-white flex items-center justify-center transition-colors"
                                                style={{color: courseColor[300], backgroundColor: courseColor[50]}}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = courseColor[500]; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = courseColor[50]; e.currentTarget.style.color = courseColor[300]; }}
                                            >
                                                <CheckCircle2 className="w-6 h-6" />
                                            </button>
                                        </div>
                                    )
                                })}</div>)}
                            </div>
                        )}

                        {/* Timeline Horizontal Layout */}
                        <div className="flex xl:grid xl:grid-cols-7 gap-4 overflow-x-auto xl:overflow-visible pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
                            {next7Days.map((date, index) => {
                                const dayTasks = getTasksForDate(date);
                                const isToday = isActuallyToday(date);
                                const hasTasks = dayTasks.length > 0;

                                // Logique de style épuré et transparent
                                let containerClass = "";
                                let headerClass = "";

                                if (isToday) {
                                    // Aujourd'hui : On garde une mise en avant mais plus légère/translucide
                                    containerClass = "bg-white/70 border-[var(--theme-300)]/30 shadow-xl ring-1 ring-white/50 z-10 backdrop-blur-md";
                                    headerClass = "bg-[var(--theme-50)]/40 border-b border-[var(--theme-200)]/20";
                                } else if (hasTasks) {
                                    // Jours avec cours : Transparence moyenne pour voir le fond mais grouper le contenu
                                    containerClass = "bg-white/40 border-white/20 shadow-sm backdrop-blur-md hover:bg-white/50 transition-colors";
                                    headerClass = "bg-white/20 border-b border-white/10";
                                } else {
                                    // Jours vides : Très transparent ("Rien de prévu"), effet "ghost"
                                    containerClass = "bg-white/10 border-transparent shadow-none backdrop-blur-sm";
                                    headerClass = "bg-transparent border-none";
                                }

                                return (
                                    <div key={date.toISOString()} className={`min-w-[85vw] sm:min-w-[320px] xl:min-w-0 flex-shrink-0 snap-center rounded-2xl border flex flex-col h-[70vh] sm:h-[600px] ${containerClass}`}>
                                        <div className={`p-4 flex justify-between rounded-t-2xl sticky top-0 z-10 ${headerClass}`}>
                                            <div>
                                                <h3 className={`font-bold text-lg capitalize ${isToday ? 'text-[var(--theme-900)]' : 'text-slate-800'}`}>
                                                    {getDayLabel(date)}
                                                </h3>
                                                <p className={`text-xs font-medium ${isToday ? 'text-[var(--theme-700)]' : 'text-slate-600'}`}>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
                                            </div>
                                            {dayTasks.length > 0 && <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isToday ? 'bg-white/80 text-[var(--theme-700)] border-[var(--theme-200)]' : 'bg-white/60 text-slate-700 border-white/40'}`}>{dayTasks.length}</span>}
                                        </div>
                                        <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                            {dayTasks.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-500/80">
                                                    <div className="bg-white/20 p-3 rounded-full mb-2 backdrop-blur-sm">
                                                        <Clock className="w-8 h-8 opacity-60" />
                                                    </div>
                                                    <p className="text-sm font-medium font-sans bg-white/30 px-3 py-1 rounded-full backdrop-blur-md">Rien de prévu</p>
                                                </div>
                                            ) : dayTasks.map(task => {
                                                const courseColor = getCourseColor(task.courseId);
                                                return (
                                                    <div key={`${task.courseId}-${task.jKey}`} className={`bg-white/95 p-3.5 rounded-xl border shadow-sm group relative overflow-hidden ${task.done ? 'opacity-60 grayscale' : ''}`} style={{borderColor: !task.done ? courseColor[200] : 'transparent'}}>
                                                        {/* ... contenu carte inchangé car bg-white/95 assure l'opacité demandée ... */}
                                                        <div className="flex justify-between items-start gap-3 relative z-10">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex gap-2 mb-1.5">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded`} style={{backgroundColor: task.jKey === 'J0' ? '#1e293b' : courseColor[100], color: task.jKey === 'J0' ? '#fff' : courseColor[700]}}>
                                                    {task.jKey}
                                                </span>
                                                                    <span className="text-xs font-semibold text-slate-500 truncate">{task.courseSubject}</span>
                                                                </div>
                                                                <h4 className={`font-semibold text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.courseName}</h4>
                                                            </div>
                                                            <button
                                                                onClick={() => toggleReview(task.courseId, task.jKey)}
                                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors`}
                                                                style={
                                                                    task.done
                                                                        ? { backgroundColor: '#ecfdf5', color: '#059669' }
                                                                        : { backgroundColor: courseColor[50], color: courseColor[300], borderColor: courseColor[200], border: '1px solid' }
                                                                }
                                                                onMouseEnter={(e) => { if(!task.done) { e.currentTarget.style.backgroundColor = courseColor[500]; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = courseColor[500]; } }}
                                                                onMouseLeave={(e) => { if(!task.done) { e.currentTarget.style.backgroundColor = courseColor[50]; e.currentTarget.style.color = courseColor[300]; e.currentTarget.style.borderColor = courseColor[200]; } }}
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                        {!task.done && <div className="absolute bottom-0 left-0 h-0.5 w-full" style={{backgroundColor: courseColor[200]}}></div>}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ... All Courses View ... */}
                {activeTab === 'all' && (
                    <div className="space-y-4 max-w-4xl mx-auto animate-slide-up-fade">
                        <div className="flex justify-between mb-4 px-1"><h2 className="font-bold text-slate-800 text-lg">Répertoire ({userProfile?.currentSemester})</h2><div className="text-xs font-medium bg-white/90 backdrop-blur-sm px-2 py-1 rounded border">Total : {currentSemesterCourses.length}</div></div>
                        {currentSemesterCourses.length === 0 && <div className="text-center py-16 bg-white/90 backdrop-blur-sm rounded-2xl border border-dashed"><p className="text-slate-400 mb-4">Aucun cours.</p><button onClick={() => setActiveTab('add')} className="text-[var(--theme-600)] font-bold hover:underline">Ajouter</button></div>}
                        {currentSemesterCourses.map(course => {
                            const courseColor = getCourseColor(course.id);
                            return (
                                <div key={course.id} className="bg-white/95 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="p-5 flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block" style={{backgroundColor: courseColor[50], color: courseColor[600]}}>{course.subject}</span>
                                            <h3 className="font-bold text-slate-800 text-lg">{course.name}</h3>
                                            <div className="flex items-center gap-3 mt-4">
                                                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full transition-all duration-700" style={{ width: `${course.progress}%`, backgroundColor: courseColor[500] }} />
                                                </div>
                                                <span className="text-xs font-bold" style={{color: courseColor[600]}}>{course.progress}%</span>
                                            </div>
                                        </div>
                                        <button onClick={() => requestDeleteCourse(course.id)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="grid grid-cols-7 border-t border-slate-100">
                                        {course.reviews.map(review => {
                                            const isPast = new Date(review.date) < new Date() && new Date(review.date).toDateString() !== new Date().toDateString();
                                            // Cellule de la grille
                                            const cellStyle = review.done
                                                ? { backgroundColor: courseColor[50] }
                                                : isPast
                                                    ? { backgroundColor: '#fff1f2' }
                                                    : { backgroundColor: 'transparent' };

                                            // Pastille/Texte
                                            const content = review.done
                                                ? <div className="w-2 h-2 rounded-full" style={{backgroundColor: courseColor[500]}}></div>
                                                : <span className={`text-[10px] font-bold ${isPast ? 'text-rose-400' : 'text-slate-300'}`}>{review.interval}</span>;

                                            return (<div key={review.jKey} onClick={() => toggleReview(course.id, review.jKey)} className={`h-12 flex items-center justify-center border-r border-slate-100 last:border-r-0 cursor-pointer hover:opacity-80`} style={cellStyle}>{content}</div>)
                                        })}
                                    </div>
                                </div>
                            )})}
                    </div>
                )}
            </main>

            {/* FAB Mobile */}
            {activeTab !== 'add' && <button onClick={() => setActiveTab('add')} className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--theme-600)] hover:bg-[var(--theme-700)] text-white rounded-full shadow-lg flex items-center justify-center md:hidden z-30"><Plus className="w-7 h-7" /></button>}

            {/* ... (Modales inchangées) ... */}
            {courseToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center">
                        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8 text-rose-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Supprimer ce cours ?</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            Cette action est irréversible. Tout l'historique de révision associé sera perdu.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setCourseToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Annuler</button>
                            <button onClick={confirmDeleteCourse} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors">Supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            {alertInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center relative">
                        <button onClick={() => setAlertInfo(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alertInfo.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-[var(--theme-100)] text-[var(--theme-600)]'}`}>
                            {alertInfo.type === 'error' ? <AlertTriangle className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{alertInfo.title}</h3>
                        <p className="text-slate-500 text-sm mb-6">{alertInfo.message}</p>
                        <button onClick={() => setAlertInfo(null)} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">J'ai compris</button>
                    </div>
                </div>
            )}

        </div>
    );
}