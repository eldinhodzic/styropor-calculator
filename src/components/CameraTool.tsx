import { useState, useRef, useEffect } from 'react';
import { Camera, Ruler, Image as ImageIcon, X, RefreshCw } from 'lucide-react';

interface Props {
    onCapture: (base64Image: string) => void;
    isLoading?: boolean;
}

export default function CameraTool({ onCapture, isLoading = false }: Props) {
    const [isActive, setIsActive] = useState(false);
    const [hasCameraError, setHasCameraError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        setIsActive(true);
        setHasCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // prefer rear camera
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setHasCameraError(true);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsActive(false);
    };

    const takePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;

        // Create a canvas to draw the current video frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.8);

            // Stop camera and send data
            stopCamera();
            onCapture(base64Data);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                onCapture(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isActive) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    {isLoading ? <RefreshCw className="animate-spin" size={32} /> : <Camera size={32} />}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">
                        {isLoading ? 'AI Fotometing Bezig...' : 'AI Fotometing'}
                    </h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        {isLoading
                            ? 'Claude is de muur en ramen aan het analyseren. Dit duurt enkele seconden.'
                            : 'Maak een foto van de muur met een referentieobject (zoals een A4-papiertje) of selecteer een bestaande foto.'}
                    </p>
                </div>

                {!isLoading && (
                    <div className="flex space-x-3 w-full max-w-xs pt-4">
                        <button
                            onClick={startCamera}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Camera size={18} />
                            Camera
                        </button>
                        <label className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer">
                            <ImageIcon size={18} />
                            Gallerij
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg relative h-[60vh] flex flex-col">
            {hasCameraError ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-black p-6 text-center">
                    <p className="text-red-400 font-medium mb-4">Kan de camera niet laden. Controleer je permissies.</p>
                    <button
                        onClick={stopCamera}
                        className="bg-white text-slate-900 py-2 px-6 rounded-lg font-medium"
                    >
                        Terug
                    </button>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover bg-black"
                />
            )}

            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between items-start pointer-events-auto">
                    <button
                        onClick={stopCamera}
                        className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 backdrop-blur-md transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <div className="bg-black/50 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md flex items-center gap-2">
                        <Ruler size={16} />
                        Houd A4-papier in beeld
                    </div>
                </div>

                <div className="flex justify-center pb-4 pointer-events-auto">
                    <button
                        onClick={takePhoto}
                        className="h-16 w-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                    >
                        <div className="h-12 w-12 bg-white rounded-full border-2 border-slate-200"></div>
                    </button>
                </div>
            </div>
        </div>
    );
}
