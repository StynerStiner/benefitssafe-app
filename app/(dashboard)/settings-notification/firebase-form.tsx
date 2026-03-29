'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { handleFirebaseSettings } from './actions';

const firebaseFields = [
    { id: 'firebaseSecretKey', label: 'Firebase Secret Key' },
    { id: 'firebasePublicVapidKey', label: 'Firebase Public Vapid Key (key pair)' },
    { id: 'firebaseAPIKey', label: 'Firebase API Key' },
    { id: 'firebaseAuthDomain', label: 'Firebase AUTH Domain' },
    { id: 'firebaseProjectID', label: 'Firebase Project ID' },
    { id: 'firebaseStorageBucket', label: 'Firebase Storage Bucket' },
    { id: 'firebaseMessageSenderID', label: 'Firebase Message Sender ID' },
    { id: 'firebaseAppID', label: 'Firebase App ID' },
    { id: 'firebaseMeasurementID', label: 'Firebase Measurement ID', colSpan: 2 },
];

const FirebaseSettingsForm = () => {
    return (
        <form action={handleFirebaseSettings}>
            <div className="grid md:grid-cols-2 gap-5">
                {firebaseFields.map(({ id, label, colSpan }) => (
                    <div key={id} className={`${colSpan === 2 ? 'md:col-span-2' : ''}`}>
                        <Label htmlFor={id} className="text-sm font-semibold mb-2 block text-foreground">
                            {label}
                        </Label>
                        <Input
                            id={id}
                            name={id}
                            type="text"
                            placeholder={label}
                            className="border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0"
                        />
                    </div>
                ))}

                <div className="flex items-center justify-center gap-4 mt-6 md:col-span-2">
                    <Button
                        type="reset"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 h-12 px-10"
                    >
                        Reset
                    </Button>
                    <Button type="submit" className="h-12 px-10">
                        Save Changes
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default FirebaseSettingsForm;
