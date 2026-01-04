"use client";

import React, { useState, useEffect } from 'react';
import {
    CheckCircle2, Plus, Trash2, BookOpen, Activity, AlertCircle,
    CalendarDays, Clock, ChevronDown, ChevronUp, Settings, RefreshCcw,
    User, GraduationCap, School, LogOut, Loader2, Key,
    ChevronLeft, ChevronRight, Calendar
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

type Tab = 'planning' | 'all' | 'add';

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

// Obtenir le numéro de semaine (ISO 8601)
const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Obtenir le Lundi de la semaine pour une date donnée
const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 (Dimanche) à 6 (Samedi)
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour que Lundi soit le 1er jour
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

export default function Home() {
    // --- ETATS ---
    const [user, setUser] = useState<FirebaseUser | null>(null);

    // États de chargement distincts pour une UX fluide
    const [loadingAuth, setLoadingAuth] = useState(true);      // Vérif si connecté
    const [loadingProfile, setLoadingProfile] = useState(true); // Vérif si profil existe
    const [envError, setEnvError] = useState(false);

    const [courses, setCourses] = useState<Course[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Modale affichée uniquement si le chargement est fini ET qu'il n'y a pas de profil
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Formulaire d'ajout
    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseSubject, setNewCourseSubject] = useState('');
    const [learningDate, setLearningDate] = useState('');

    // Navigation Planning : Initialisé au Lundi de la semaine actuelle
    const [planningStartDate, setPlanningStartDate] = useState<Date>(() => {
        return getStartOfWeek(new Date());
    });

    // Profil temporaire (Formulaire)
    const [tempProfile, setTempProfile] = useState<UserProfile>({
        firstName: '', lastName: '', university: '', courseType: 'PASS', currentSemester: 'S1'
    });

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customIntervals, setCustomIntervals] = useState<number[]>(DEFAULT_INTERVALS);
    const [activeTab, setActiveTab] = useState<Tab>('planning');
    const [showOverdue, setShowOverdue] = useState(true);

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
            setLoadingAuth(false); // Auth vérifiée

            if (currentUser) {
                // On commence le chargement du profil
                setLoadingProfile(true);

                // 1. Écouter le Profil
                const profileRef = doc(db, 'users', currentUser.uid);
                const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
                    if (docSnap.exists()) {
                        // Profil trouvé !
                        const data = docSnap.data() as UserProfile;
                        setUserProfile(data);
                        setTempProfile(data); // Pré-remplir le formulaire au cas où
                        setShowProfileModal(false);
                    } else {
                        // Pas de profil -> On force la modale
                        setUserProfile(null);
                        setShowProfileModal(true);
                    }
                    setLoadingProfile(false); // Chargement profil terminé
                }, (error) => {
                    console.error("Erreur lecture profil:", error);
                    setLoadingProfile(false);
                });

                // 2. Écouter les Cours
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
                // Reset si déconnecté
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
            }
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setUserProfile(null);
        setShowProfileModal(false);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !tempProfile.firstName.trim()) return;

        // On met loadingProfile à true pour éviter le flash pendant la sauvegarde
        setLoadingProfile(true);

        try {
            await setDoc(doc(db, 'users', user.uid), tempProfile);
            // Pas besoin de setShowProfileModal(false) ici,
            // car le onSnapshot va détecter le changement et le faire automatiquement
        } catch (error) {
            console.error("Erreur sauvegarde profil", error);
            setLoadingProfile(false); // On remet à false en cas d'erreur
            alert("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
        }
    };

    const switchSemester = async () => {
        if (!user || !userProfile) return;
        const newSem = userProfile.currentSemester === 'S1' ? 'S2' : 'S1';

        // Optimistic update pour réactivité immédiate
        setUserProfile({ ...userProfile, currentSemester: newSem });

        await updateDoc(doc(db, 'users', user.uid), {
            currentSemester: newSem
        });
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
            alert("Sélectionnez au moins un intervalle.");
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

    const deleteCourse = async (id: string) => {
        if (!user) return;
        if (window.confirm("Supprimer ce cours définitivement ?")) {
            await deleteDoc(doc(db, 'users', user.uid, 'courses', id));
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
        // Réinitialise au Lundi de la semaine actuelle
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

        // Calcul de la différence en jours
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

    // 2. Chargement initial (Auth OU Profil)
    if (loadingAuth || (user && loadingProfile)) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">
                {loadingAuth ? 'Connexion en cours...' : 'Récupération de votre profil...'}
            </p>
        </div>
    );

    // 3. Login
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-fade-in">
                    <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Activity className="w-10 h-10 text-indigo-600" />
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

    // 4. Modale Profil
    if (showProfileModal) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                    <div className="bg-indigo-600 p-6 text-white text-center">
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
                                <input type="text" required className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none" value={tempProfile.firstName} onChange={(e) => setTempProfile({...tempProfile, firstName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
                                <input type="text" required className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none" value={tempProfile.lastName} onChange={(e) => setTempProfile({...tempProfile, lastName: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Université</label>
                            <input type="text" required list="university-suggestions" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none" value={tempProfile.university} onChange={(e) => setTempProfile({...tempProfile, university: e.target.value})} />
                            <datalist id="university-suggestions">{UNIVERSITY_SUGGESTIONS.map((uni) => (<option key={uni} value={uni} />))}</datalist>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cursus</label>
                                <select className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none bg-white" value={tempProfile.courseType} onChange={(e) => setTempProfile({...tempProfile, courseType: e.target.value as CourseType})}>
                                    <option value="PASS">PASS</option><option value="LAS">LAS</option><option value="PACES">PACES</option><option value="Autre">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semestre</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setTempProfile({...tempProfile, currentSemester: 'S1'})} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${tempProfile.currentSemester === 'S1' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>S1</button>
                                    <button type="button" onClick={() => setTempProfile({...tempProfile, currentSemester: 'S2'})} className={`flex-1 py-2 rounded-lg text-sm font-bold border ${tempProfile.currentSemester === 'S2' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>S2</button>
                                </div>
                            </div>
                        </div>
                        <button type="submit" disabled={loadingProfile} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl mt-4 flex justify-center">
                            {loadingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Valider mon profil'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 5. App Principale
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 pb-24">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm/50 backdrop-blur-md bg-white/90">
                <div className="max-w-[95%] mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
                            <Activity className="text-white w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg leading-none text-indigo-900">Med&J</span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {userProfile?.courseType} • {userProfile?.university}
              </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {userProfile && (userProfile.courseType === 'PASS' || userProfile.courseType === 'LAS') && (
                            <button onClick={switchSemester} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-full border border-slate-200 transition-all group">
                                <span className={`text-xs font-bold ${userProfile.currentSemester === 'S1' ? 'text-indigo-600' : 'text-slate-400'}`}>S1</span>
                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${userProfile.currentSemester === 'S2' ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${userProfile.currentSemester === 'S2' ? 'translate-x-4' : ''}`} />
                                </div>
                                <span className={`text-xs font-bold ${userProfile.currentSemester === 'S2' ? 'text-indigo-600' : 'text-slate-400'}`}>S2</span>
                            </button>
                        )}
                        <button onClick={() => setShowProfileModal(true)} className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><User className="w-5 h-5" /></button>
                        <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600 transition-colors" title="Déconnexion"><LogOut className="w-5 h-5" /></button>
                    </div>
                </div>
            </header>

            {/* CONTENU */}
            <main className="max-w-[95%] mx-auto px-4 py-6">
                <div className="mb-6 animate-fade-in flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Bonjour, {userProfile?.firstName} 👋</h1>
                        <p className="text-slate-500 text-sm">Programme pour le <span className="font-semibold text-indigo-600">{userProfile?.currentSemester}</span>.</p>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto">
                    <button onClick={() => setActiveTab('planning')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'planning' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><CalendarDays className="w-4 h-4" />Planning</button>
                    <button onClick={() => setActiveTab('all')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><BookOpen className="w-4 h-4" />Cours</button>
                    <button onClick={() => setActiveTab('add')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${activeTab === 'add' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-4 h-4" />Ajouter</button>
                </div>

                {/* VUE: AJOUTER */}
                {activeTab === 'add' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-xl mx-auto">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100"><Plus className="w-5 h-5 text-indigo-600" />Nouveau cours</h2>
                        <form onSubmit={handleAddCourse} className="space-y-5">
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Matière</label><input type="text" placeholder="Ex: Anatomie..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" value={newCourseSubject} onChange={(e) => setNewCourseSubject(e.target.value)} /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Titre du cours</label><input type="text" placeholder="Ex: Le squelette..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Appris le (J0)</label><input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600" value={learningDate} onChange={(e) => setLearningDate(e.target.value)} /></div>
                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600"><Settings className="w-4 h-4" />{showAdvanced ? 'Masquer' : 'Personnaliser (J)'}{showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
                                {showAdvanced && (<div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100"><div className="flex justify-between mb-3"><span className="text-xs font-bold text-slate-500 uppercase">Fréquence</span><button type="button" onClick={() => setCustomIntervals(DEFAULT_INTERVALS)} className="text-[10px] bg-white border px-2 py-1 rounded"><RefreshCcw className="w-3 h-3 inline mr-1" />Reset</button></div><div className="grid grid-cols-6 sm:grid-cols-8 gap-2">{AVAILABLE_OPTS.map(j => (<button key={j} type="button" onClick={() => toggleCustomInterval(j)} className={`h-9 rounded-lg text-sm font-bold border ${customIntervals.includes(j) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>J{j}</button>))}</div></div>)}
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-2">Générer le planning</button>
                        </form>
                    </div>
                )}

                {/* VUE: PLANNING */}
                {activeTab === 'planning' && (
                    <div className="space-y-6">

                        {/* Contrôles de navigation (Nouveau) */}
                        <div className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-4 sticky top-16 z-10 backdrop-blur-sm bg-white/90">
                            <button
                                onClick={handlePrevWeek}
                                className="p-3 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                                title="Semaine précédente"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex flex-col items-center">
                                {/* Label Semaine Dynamique */}
                                {(() => {
                                    const end = new Date(planningStartDate);
                                    end.setDate(end.getDate() + 6);
                                    const weekNum = getWeekNumber(planningStartDate);
                                    const startMonth = planningStartDate.toLocaleDateString('fr-FR', { month: 'long' });
                                    const endMonth = end.toLocaleDateString('fr-FR', { month: 'long' });

                                    return (
                                        <>
                                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-0.5">Semaine {weekNum}</span>
                                            <span className="text-sm font-bold text-slate-800 capitalize">
                                  {planningStartDate.getDate()} {startMonth === endMonth ? '' : startMonth} - {end.getDate()} {endMonth}
                              </span>
                                        </>
                                    )
                                })()}

                                {/* Bouton reset si on n'est pas sur la semaine actuelle */}
                                {planningStartDate.getTime() !== getStartOfWeek(new Date()).getTime() && (
                                    <button
                                        onClick={handleResetToday}
                                        className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 mt-1 flex items-center gap-1 transition-colors"
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
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl overflow-hidden shadow-sm max-w-4xl mx-auto">
                                <button onClick={() => setShowOverdue(!showOverdue)} className="w-full px-5 py-3 flex items-center justify-between bg-rose-100/50 text-rose-700 font-bold"><div className="flex items-center gap-2"><AlertCircle className="w-5 h-5" /><span>En Retard ({overdueTasks.length})</span></div>{showOverdue ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                                {showOverdue && (<div className="p-2 grid gap-2 sm:grid-cols-2">{overdueTasks.map((task) => (<div key={`${task.courseId}-${task.jKey}`} className="bg-white p-3 rounded-xl border-l-4 border-l-rose-500 shadow-sm flex justify-between items-center"><div className="min-w-0 flex-1 pr-3"><div className="flex gap-2 mb-1"><span className="text-[10px] font-black bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded">{task.jKey}</span><span className="text-xs text-slate-400 truncate">{task.courseSubject}</span></div><h3 className="font-semibold text-slate-800 text-sm truncate">{task.courseName}</h3></div><button onClick={() => toggleReview(task.courseId, task.jKey)} className="w-10 h-10 rounded-full bg-rose-50 text-rose-300 hover:bg-emerald-500 hover:text-white flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></button></div>))}</div>)}
                            </div>
                        )}

                        {/* Timeline Horizontal Layout */}
                        <div className="flex xl:grid xl:grid-cols-7 gap-4 overflow-x-auto xl:overflow-visible pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
                            {next7Days.map((date, index) => {
                                const dayTasks = getTasksForDate(date);
                                const isToday = isActuallyToday(date);

                                return (
                                    <div key={date.toISOString()} className={`min-w-[85vw] sm:min-w-[320px] xl:min-w-0 flex-shrink-0 snap-center rounded-2xl border flex flex-col h-[70vh] sm:h-[600px] ${isToday ? 'bg-white border-indigo-200 shadow-xl ring-1 ring-indigo-50 z-10' : 'bg-white border-slate-200 shadow-sm opacity-95'}`}>
                                        <div className={`p-4 border-b flex justify-between rounded-t-2xl sticky top-0 z-10 ${isToday ? 'bg-indigo-50/80 backdrop-blur-sm' : 'bg-slate-50/80'}`}>
                                            <div>
                                                <h3 className={`font-bold text-lg capitalize ${isToday ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                    {getDayLabel(date)}
                                                </h3>
                                                <p className="text-xs font-medium text-slate-400">{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
                                            </div>
                                            {dayTasks.length > 0 && <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isToday ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-500'}`}>{dayTasks.length}</span>}
                                        </div>
                                        <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                            {dayTasks.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-300"><Clock className="w-10 h-10 mb-3 opacity-20" /><p className="text-sm font-medium">Rien de prévu</p></div> : dayTasks.map(task => (<div key={`${task.courseId}-${task.jKey}`} className={`bg-white p-3.5 rounded-xl border shadow-sm group relative overflow-hidden ${task.done ? 'opacity-60 grayscale' : 'hover:border-indigo-300'}`}><div className="flex justify-between items-start gap-3 relative z-10"><div className="min-w-0 flex-1"><div className="flex gap-2 mb-1.5"><span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${task.jKey === 'J0' ? 'bg-slate-800 text-white' : 'bg-indigo-100 text-indigo-700'}`}>{task.jKey}</span><span className="text-xs font-semibold text-slate-400 truncate">{task.courseSubject}</span></div><h4 className={`font-semibold text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.courseName}</h4></div><button onClick={() => toggleReview(task.courseId, task.jKey)} className={`w-10 h-10 rounded-full flex items-center justify-center ${task.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-300 border hover:bg-emerald-500 hover:text-white'}`}><CheckCircle2 className="w-5 h-5" /></button></div>{!task.done && <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500/20 w-full"></div>}</div>))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ... All Courses View ... */}
                {activeTab === 'all' && (
                    <div className="space-y-4 max-w-4xl mx-auto">
                        <div className="flex justify-between mb-4 px-1"><h2 className="font-bold text-slate-800 text-lg">Répertoire ({userProfile?.currentSemester})</h2><div className="text-xs font-medium bg-white px-2 py-1 rounded border">Total : {currentSemesterCourses.length}</div></div>
                        {currentSemesterCourses.length === 0 && <div className="text-center py-16 bg-white rounded-2xl border border-dashed"><p className="text-slate-400 mb-4">Aucun cours.</p><button onClick={() => setActiveTab('add')} className="text-indigo-600 font-bold hover:underline">Ajouter</button></div>}
                        {currentSemesterCourses.map(course => (
                            <div key={course.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-5 flex justify-between items-start">
                                    <div><span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase mb-2 inline-block">{course.subject}</span><h3 className="font-bold text-slate-800 text-lg">{course.name}</h3><div className="flex items-center gap-3 mt-4"><div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${course.progress}%` }} /></div><span className="text-xs font-bold text-emerald-600">{course.progress}%</span></div></div>
                                    <button onClick={() => deleteCourse(course.id)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 className="w-4 h-4" /></button>
                                </div>
                                <div className="grid grid-cols-7 border-t border-slate-100">
                                    {course.reviews.map(review => {
                                        const isPast = new Date(review.date) < new Date() && new Date(review.date).toDateString() !== new Date().toDateString();
                                        return (<div key={review.jKey} onClick={() => toggleReview(course.id, review.jKey)} className={`h-12 flex items-center justify-center border-r border-slate-100 last:border-r-0 cursor-pointer ${review.done ? 'bg-emerald-50/50' : isPast ? 'bg-rose-50/50' : 'bg-white'}`}>{review.done ? <div className="w-2 h-2 rounded-full bg-emerald-500"></div> : <span className={`text-[10px] font-bold ${isPast ? 'text-rose-400' : 'text-slate-300'}`}>{review.interval}</span>}</div>)
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* FAB Mobile */}
            {activeTab !== 'add' && <button onClick={() => setActiveTab('add')} className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center md:hidden z-30"><Plus className="w-7 h-7" /></button>}
        </div>
    );
}