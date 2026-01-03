"use client";

import React, { useState, useEffect } from 'react';
import {
    CheckCircle2,
    Plus,
    Trash2,
    BookOpen,
    Activity,
    AlertCircle,
    CalendarDays,
    Clock,
    ChevronDown,
    ChevronUp,
    Settings,
    RefreshCcw
} from 'lucide-react';

// --- TYPES ---
type Review = {
    jKey: string;
    date: string;
    done: boolean;
    interval: number;
};

type Course = {
    id: string;
    name: string;
    subject: string;
    startDate: string;
    reviews: Review[];
    progress: number;
};

type Tab = 'planning' | 'all' | 'add';

// Configuration par défaut (Méthode classique)
const DEFAULT_INTERVALS = [0, 1, 3, 7, 14, 30, 60];

// Liste des intervalles sélectionnables pour le mode avancé
const AVAILABLE_OPTS = [0, 1, 2, 3, 4, 5, 7, 10, 14, 15, 20, 21, 28, 30, 42, 45, 60];

export default function Home() {
    // --- ETATS ---
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Formulaire
    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseSubject, setNewCourseSubject] = useState('');
    const [learningDate, setLearningDate] = useState('');

    // Options avancées (Custom J)
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customIntervals, setCustomIntervals] = useState<number[]>(DEFAULT_INTERVALS);

    const [activeTab, setActiveTab] = useState<Tab>('planning');
    const [showOverdue, setShowOverdue] = useState(true);

    // Initialisation
    useEffect(() => {
        setLearningDate(new Date().toISOString().split('T')[0]);
        const saved = localStorage.getItem('jtrack_courses');
        if (saved) {
            try {
                setCourses(JSON.parse(saved));
            } catch (e) {
                console.error("Erreur de lecture des données", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Sauvegarde
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('jtrack_courses', JSON.stringify(courses));
        }
    }, [courses, isLoaded]);

    // --- UTILITAIRES ---
    const addDays = (dateString: string, days: number): Date => {
        const result = new Date(dateString);
        result.setDate(result.getDate() + days);
        return result;
    };

    const getDayName = (dateObj: Date) => {
        return dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    // --- ACTIONS ---

    const toggleCustomInterval = (val: number) => {
        setCustomIntervals(prev => {
            if (prev.includes(val)) {
                return prev.filter(i => i !== val);
            } else {
                return [...prev, val].sort((a, b) => a - b);
            }
        });
    };

    const handleAddCourse = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCourseName.trim() || !newCourseSubject.trim()) return;

        // Choix des intervalles : soit custom si le menu est ouvert, soit défaut
        const intervalsToUse = showAdvanced ? customIntervals : DEFAULT_INTERVALS;

        if (intervalsToUse.length === 0) {
            alert("Veuillez sélectionner au moins un intervalle (ex: J0).");
            return;
        }

        const reviews: Review[] = intervalsToUse.map((interval) => ({
            jKey: `J${interval}`,
            date: addDays(learningDate, interval).toISOString(),
            done: false,
            interval: interval
        }));

        const newCourse: Course = {
            id: crypto.randomUUID(),
            name: newCourseName,
            subject: newCourseSubject,
            startDate: learningDate,
            reviews: reviews,
            progress: 0
        };

        setCourses([newCourse, ...courses]);

        // Reset form
        setNewCourseName('');
        setNewCourseSubject('');
        // On ne reset pas forcément la date pour permettre l'enchaînement
        // On peut refermer le menu avancé ou le laisser ouvert selon la préférence UX.
        // Ici je le laisse tel quel pour enchainer des configs similaires.
        setActiveTab('planning');
    };

    const toggleReview = (courseId: string, jKey: string) => {
        setCourses(courses.map(course => {
            if (course.id !== courseId) return course;

            const updatedReviews = course.reviews.map(review =>
                review.jKey === jKey ? { ...review, done: !review.done } : review
            );

            const doneCount = updatedReviews.filter(r => r.done).length;
            const progress = Math.round((doneCount / updatedReviews.length) * 100);

            return { ...course, reviews: updatedReviews, progress };
        }));
    };

    const deleteCourse = (id: string) => {
        if (window.confirm("Voulez-vous vraiment supprimer ce cours et tout son historique ?")) {
            setCourses(courses.filter(c => c.id !== id));
        }
    };

    // --- LOGIQUE PLANNING ---
    const getOverdueTasks = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tasks: (Review & { courseName: string; courseSubject: string; courseId: string })[] = [];
        courses.forEach(course => {
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

    const getTasksForDate = (targetDate: Date) => {
        const tasks: (Review & { courseName: string; courseSubject: string; courseId: string })[] = [];
        courses.forEach(course => {
            course.reviews.forEach(review => {
                const rDate = new Date(review.date);
                if (isSameDay(rDate, targetDate)) {
                    tasks.push({ ...review, courseName: course.name, courseSubject: course.subject, courseId: course.id });
                }
            });
        });
        return tasks;
    };

    const generateNext7Days = () => {
        const days = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const overdueTasks = getOverdueTasks();
    const next7Days = generateNext7Days();

    // Si pas encore chargé
    if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Chargement...</div>;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 pb-24">

            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm/50 backdrop-blur-md bg-white/80">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
                            <Activity className="text-white w-5 h-5" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-indigo-900 hidden sm:inline">J-Master<span className="text-indigo-500">.Med</span></span>
                        <span className="font-bold text-xl tracking-tight text-indigo-900 sm:hidden">J-M<span className="text-indigo-500">.Med</span></span>
                    </div>
                    <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        {courses.length} Cours
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">

                {/* Navigation Tabs */}
                <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto">
                    <button
                        onClick={() => setActiveTab('planning')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${activeTab === 'planning' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <CalendarDays className="w-4 h-4" />
                        Planning
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${activeTab === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Cours
                    </button>
                    <button
                        onClick={() => setActiveTab('add')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${activeTab === 'add' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </button>
                </div>

                {/* --- VUE: AJOUTER --- */}
                {activeTab === 'add' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in max-w-xl mx-auto">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
                            <Plus className="w-5 h-5 text-indigo-600" />
                            Nouveau cours
                        </h2>
                        <form onSubmit={handleAddCourse} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Matière (UE)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Anatomie, SSH..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
                                    value={newCourseSubject}
                                    onChange={(e) => setNewCourseSubject(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Intitulé du cours</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Le squelette axial"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
                                    value={newCourseName}
                                    onChange={(e) => setNewCourseName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Appris le (J0)</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-600"
                                    value={learningDate}
                                    onChange={(e) => setLearningDate(e.target.value)}
                                />
                            </div>

                            {/* OPTIONS AVANCÉES (Sélecteur de J) */}
                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                    {showAdvanced ? 'Masquer les options avancées' : 'Personnaliser les répétitions (J)'}
                                    {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>

                                {showAdvanced && (
                                    <div className="mt-4 animate-fade-in bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Fréquence des rappels</span>
                                            <button
                                                type="button"
                                                onClick={() => setCustomIntervals(DEFAULT_INTERVALS)}
                                                className="text-[10px] flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-100"
                                            >
                                                <RefreshCcw className="w-3 h-3" />
                                                Réinitialiser
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                                            {AVAILABLE_OPTS.map(j => {
                                                const isSelected = customIntervals.includes(j);
                                                return (
                                                    <button
                                                        key={j}
                                                        type="button"
                                                        onClick={() => toggleCustomInterval(j)}
                                                        className={`
                              h-9 rounded-lg text-sm font-bold transition-all border
                              ${isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                            : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}
                            `}
                                                    >
                                                        J{j}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 italic">
                                            Sélectionnez les jours où vous souhaitez réviser ce cours.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Générer le planning
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* --- VUE: PLANNING (COLONNES) --- */}
                {activeTab === 'planning' && (
                    <div className="space-y-6 animate-fade-in">

                        {/* 1. Section Retard (En haut, pleine largeur) */}
                        {overdueTasks.length > 0 && (
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl overflow-hidden shadow-sm max-w-4xl mx-auto">
                                <button
                                    onClick={() => setShowOverdue(!showOverdue)}
                                    className="w-full px-5 py-3 flex items-center justify-between bg-rose-100/50 hover:bg-rose-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-rose-700 font-bold">
                                        <AlertCircle className="w-5 h-5" />
                                        <span>En Retard ({overdueTasks.length})</span>
                                    </div>
                                    {showOverdue ? <ChevronUp className="w-5 h-5 text-rose-400" /> : <ChevronDown className="w-5 h-5 text-rose-400" />}
                                </button>

                                {showOverdue && (
                                    <div className="p-2 grid gap-2 sm:grid-cols-2">
                                        {overdueTasks.map((task) => (
                                            <div key={`${task.courseId}-${task.jKey}`} className="bg-white p-3 rounded-xl border-l-4 border-l-rose-500 shadow-sm flex items-center justify-between">
                                                <div className="min-w-0 flex-1 pr-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">{task.jKey}</span>
                                                        <span className="text-xs text-slate-400 truncate">{task.courseSubject}</span>
                                                    </div>
                                                    <h3 className="font-semibold text-slate-800 text-sm truncate">{task.courseName}</h3>
                                                </div>
                                                <button
                                                    onClick={() => toggleReview(task.courseId, task.jKey)}
                                                    className="w-10 h-10 flex-shrink-0 rounded-full bg-rose-50 text-rose-300 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center"
                                                >
                                                    <CheckCircle2 className="w-6 h-6" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. Timeline des 7 prochains jours (SCROLL HORIZONTAL) */}
                        <div className="flex gap-4 overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
                            {next7Days.map((date, index) => {
                                const dayTasks = getTasksForDate(date);
                                const isTodayDate = index === 0;

                                return (
                                    <div
                                        key={date.toISOString()}
                                        className={`
                      min-w-[85vw] sm:min-w-[320px] flex-shrink-0 snap-center
                      rounded-2xl border flex flex-col h-[70vh] sm:h-[600px]
                      ${isTodayDate
                                            ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-50 z-10'
                                            : 'bg-white border-slate-200 shadow-sm opacity-95'}
                    `}
                                    >
                                        {/* Header de la colonne */}
                                        <div className={`
                      p-4 border-b flex items-center justify-between rounded-t-2xl sticky top-0 z-10
                      ${isTodayDate ? 'bg-indigo-50/80 backdrop-blur-sm border-indigo-100' : 'bg-slate-50/80 backdrop-blur-sm border-slate-100'}
                    `}>
                                            <div>
                                                <h3 className={`font-bold text-lg capitalize flex items-center gap-2 ${isTodayDate ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                    {index === 0 ? 'Aujourd\'hui' : index === 1 ? 'Demain' : getDayName(date)}
                                                    {isTodayDate && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>}
                                                </h3>
                                                <p className="text-xs font-medium text-slate-400">
                                                    {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                                </p>
                                            </div>
                                            {dayTasks.length > 0 && (
                                                <span className={`
                                text-xs font-bold px-2.5 py-1 rounded-full border
                                ${isTodayDate ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}
                            `}>
                                {dayTasks.length}
                            </span>
                                            )}
                                        </div>

                                        {/* Liste des tâches (Scrollable verticalement dans la colonne) */}
                                        <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                            {dayTasks.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                                                    <Clock className="w-10 h-10 mb-3 opacity-20" />
                                                    <p className="text-sm font-medium">Rien de prévu</p>
                                                    <p className="text-xs opacity-70">Profitez-en !</p>
                                                </div>
                                            ) : (
                                                dayTasks.map((task) => (
                                                    <div
                                                        key={`${task.courseId}-${task.jKey}`}
                                                        className={`
                              bg-white p-3.5 rounded-xl border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] group transition-all relative overflow-hidden
                              ${task.done ? 'opacity-60 border-slate-100 grayscale' : 'border-slate-100 hover:border-indigo-300 hover:shadow-md'}
                            `}
                                                    >
                                                        <div className="flex justify-between items-start gap-3 relative z-10">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`
                                        text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded
                                        ${task.jKey === 'J0' ? 'bg-slate-800 text-white' : 'bg-indigo-100 text-indigo-700'}
                                        `}>
                                        {task.jKey}
                                        </span>
                                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate max-w-[120px]">
                                            {task.courseSubject}
                                        </span>
                                                                </div>
                                                                <h4 className={`font-semibold text-slate-800 text-sm leading-snug ${task.done ? 'line-through text-slate-400' : ''}`}>
                                                                    {task.courseName}
                                                                </h4>
                                                            </div>

                                                            <button
                                                                onClick={() => toggleReview(task.courseId, task.jKey)}
                                                                className={`
                                    w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90
                                    ${task.done
                                                                    ? 'bg-emerald-100 text-emerald-600'
                                                                    : 'bg-slate-50 text-slate-300 border border-slate-200 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'}
                                `}
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </button>
                                                        </div>

                                                        {/* Petite barre de progression visuelle pour le style */}
                                                        {!task.done && (
                                                            <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500/20 w-full"></div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Carte "Voir plus" en fin de scroll */}
                            <div className="min-w-[100px] flex items-center justify-center text-slate-300 flex-col gap-2 opacity-50">
                                <CalendarDays className="w-8 h-8" />
                                <span className="text-xs font-medium text-center">Planning<br/>infini</span>
                            </div>
                        </div>

                    </div>
                )}

                {/* --- VUE: TOUS LES COURS --- */}
                {activeTab === 'all' && (
                    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="font-bold text-slate-800 text-lg">Répertoire</h2>
                            <div className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                                Total : {courses.length}
                            </div>
                        </div>

                        {courses.length === 0 && (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-400 mb-4">Votre répertoire est vide.</p>
                                <button onClick={() => setActiveTab('add')} className="text-indigo-600 font-bold hover:underline">
                                    Ajouter un premier cours
                                </button>
                            </div>
                        )}

                        {courses.map((course) => (
                            <div key={course.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-5 flex justify-between items-start">
                                    <div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block">
                      {course.subject}
                    </span>
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{course.name}</h3>

                                        {/* Progress Bar */}
                                        <div className="flex items-center gap-3 mt-4">
                                            <div className="w-full max-w-[140px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
                                                    style={{ width: `${course.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-emerald-600">{course.progress}%</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteCourse(course.id)}
                                        className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Mini Grille Visuelle */}
                                <div className="grid grid-cols-7 border-t border-slate-100">
                                    {course.reviews.map((review) => {
                                        const rDate = new Date(review.date);
                                        const isPast = rDate < new Date() && !isSameDay(rDate, new Date());

                                        // Couleur de fond de la cellule
                                        let bgClass = "bg-white";
                                        if (review.done) bgClass = "bg-emerald-50/50";
                                        else if (isPast) bgClass = "bg-rose-50/50";

                                        return (
                                            <div
                                                key={review.jKey}
                                                onClick={() => toggleReview(course.id, review.jKey)}
                                                className={`
                          h-12 flex items-center justify-center border-r border-slate-100 last:border-r-0 cursor-pointer transition-colors relative group
                          ${bgClass} hover:bg-slate-100
                        `}
                                            >
                                                {/* Tooltip date */}
                                                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                                                    {rDate.toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'})}
                                                </div>

                                                {review.done ? (
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                ) : (
                                                    <span className={`text-[10px] font-bold ${isPast ? 'text-rose-400' : 'text-slate-300'}`}>
                            {review.interval}
                          </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </main>

            {/* Floating Action Button (Mobile) */}
            {activeTab !== 'add' && (
                <button
                    onClick={() => setActiveTab('add')}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-300 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-30 md:hidden"
                >
                    <Plus className="w-7 h-7" />
                </button>
            )}
        </div>
    );
}