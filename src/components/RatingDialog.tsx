"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Star } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  passengerId: string;
}

export function RatingDialog({ isOpen, onClose, driverId, driverName, passengerId }: RatingDialogProps) {
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'ratings'), {
        driverId,
        driverName,
        passengerId,
        rating,
        createdAt: Timestamp.now(),
      });
      
      toast({
        title: "Thank you!",
        description: "Your rating has been submitted successfully.",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Could not submit your rating.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">Rate your Ride</DialogTitle>
          <DialogDescription className="font-medium">
            How was your experience with {driverName}?
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-2 py-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="transition-transform active:scale-90 hover:scale-110"
            >
              <Star
                className={`w-10 h-10 ${
                  star <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'
                }`}
              />
            </button>
          ))}
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            className="w-full bg-zinc-900 hover:bg-black text-white font-black h-12 rounded-2xl shadow-lg active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
