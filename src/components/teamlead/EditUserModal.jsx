import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function EditUserModal({ isOpen, onClose, user, onSave }) {
  const [formData, setFormData] = useState({ user_name: '', user_email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        user_name: user.user_name || '',
        user_email: user.user_email || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(user.user_email, formData);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900">Edit Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Full Name</Label>
            <Input
              id="name"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              className="rounded-xl border-slate-200 focus:ring-indigo-500"
              placeholder="e.g. John Doe"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.user_email}
              onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
              className="rounded-xl border-slate-200 focus:ring-indigo-500"
              placeholder="name@example.com"
              required
            />
            <p className="text-[10px] text-amber-600 font-medium italic">
              Note: Changing the email will update their login identifier.
            </p>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose} 
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold px-8"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}