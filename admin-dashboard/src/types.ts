export interface Station {
    id: string;
    pcName?: string;
    status: 'online' | 'offline' | 'frozen';
    lastScreenshot?: string;
    lastScreenshotTime?: any; // Firestore Timestamp
    currentUser?: string;
    isLocked?: boolean;
    isInternetBlocked?: boolean;
    timeRequest?: string;
    macAddress?: string;
    pendingCommand?: string;
    commandTimestamp?: any; // Firestore Timestamp
    lastSeen?: any; // Firestore Timestamp
}

export interface Student {
    id: string;
    studentId: string;
    name?: string;
    classGroup?: string; // e.g. "Class 9A", "Grade 10"
    weeklyTime?: number;      // quota in minutes
    dailyTime?: number;       // quota in minutes
    dailyRemainingTime?: number;  // seconds remaining today
    remainingTime?: number;       // seconds remaining this week
    password?: string;
    usernameChanges?: number;
}

export interface HistoryLog {
    id: string;
    studentId: string;
    pcName: string;
    activity: string;
    timestamp: any; // Firestore Timestamp
}
