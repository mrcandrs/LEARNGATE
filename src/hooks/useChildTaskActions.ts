import { useCallback, useRef, useState } from "react";

import type { NavigationProp } from "@react-navigation/native";

import { supabase } from "@/services/supabase";

import { useChildProfile } from "@/hooks/useChildProfile";

import { pickTaskPhotoFromCamera, uploadTaskEvidencePhoto } from "@/services/taskEvidence";

import { formatAppError } from "@/utils/errors";

import { normalizeExerciseId } from "@/data/exercises";

import type { GameId } from "@/data/childGames";

import type { ChildTabParamList } from "@/types/navigation";

import type { TaskRow } from "@/utils/childTaskDisplay";



type TabNav = NavigationProp<ChildTabParamList>;



type PendingChorePhoto = {

  task: TaskRow;

  uri: string;

};



export function useChildTaskActions(tabNav: TabNav) {

  const { child, refresh: refreshProfile } = useChildProfile();

  const [error, setError] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  const [pendingChorePhoto, setPendingChorePhoto] = useState<PendingChorePhoto | null>(null);

  const choreSuccessRef = useRef<(() => void) | null>(null);



  const completeTaskWithoutCamera = useCallback(

    async (task: TaskRow, onDone?: () => void) => {

      if (!supabase || !child || task.status === "completed") {

        return;

      }

      setError(null);



      const { error: updateError } = await supabase

        .from("tasks")

        .update({ status: "completed", completed_at: new Date().toISOString() })

        .eq("id", task.id);



      if (updateError) {

        setError(formatAppError(updateError));

        return;

      }



      const { error: awardError } = await supabase.rpc("award_child_points", {

        p_child_id: child.id,

        p_points: task.xp_reward,

        p_event_type: "task_completed",

        p_metadata: { task_id: task.id, title: task.title, source: "child_task" },

      });

      if (awardError) {

        setError(formatAppError(awardError));

        return;

      }



      setSnackbar("Task completed!");

      await refreshProfile();

      onDone?.();

    },

    [child, refreshProfile]

  );



  const captureChorePhoto = useCallback(async (task: TaskRow, onDone?: () => void) => {

    if (!supabase || !child) {

      return;

    }

    setError(null);

    choreSuccessRef.current = onDone ?? null;



    try {

      const uri = await pickTaskPhotoFromCamera();

      if (!uri) {

        choreSuccessRef.current = null;

        return;

      }

      setPendingChorePhoto({ task, uri });

    } catch (e) {

      choreSuccessRef.current = null;

      setError(formatAppError(e));

    }

  }, [child]);



  const cancelChorePhotoReview = useCallback(() => {

    if (uploadingTaskId) {

      return;

    }

    setPendingChorePhoto(null);

    choreSuccessRef.current = null;

  }, [uploadingTaskId]);



  const retakeChorePhoto = useCallback(() => {

    if (!pendingChorePhoto || uploadingTaskId) {

      return;

    }

    const { task } = pendingChorePhoto;

    const onDone = choreSuccessRef.current ?? undefined;

    setPendingChorePhoto(null);

    void captureChorePhoto(task, onDone);

  }, [pendingChorePhoto, uploadingTaskId, captureChorePhoto]);



  const submitChorePhoto = useCallback(async () => {

    if (!pendingChorePhoto || !supabase || !child) {

      return;

    }



    const { task, uri } = pendingChorePhoto;

    setError(null);

    setUploadingTaskId(task.id);



    try {

      const path = await uploadTaskEvidencePhoto({ childId: child.id, taskId: task.id, localUri: uri });



      const { error: insertError } = await supabase.from("task_submissions").insert({

        task_id: task.id,

        child_id: child.id,

        image_url: path,

        status: "submitted",

      });



      if (insertError) {

        setError(formatAppError(insertError));

        return;

      }



      const { error: taskUpdateError } = await supabase.from("tasks").update({ status: "submitted" }).eq("id", task.id);



      if (taskUpdateError) {

        setError(formatAppError(taskUpdateError));

        return;

      }



      await supabase.from("activity_logs").insert({

        child_id: child.id,

        type: "chore_submitted",

        points: 0,

        metadata: { task_id: task.id, title: task.title, storage_path: path },

      });



      setPendingChorePhoto(null);

      setSnackbar("Photo submitted! Waiting for parent review.");

      const onDone = choreSuccessRef.current;

      choreSuccessRef.current = null;

      onDone?.();

    } catch (e) {

      setError(formatAppError(e));

    } finally {

      setUploadingTaskId(null);

    }

  }, [pendingChorePhoto, child]);



  const onTaskPress = useCallback(

    (task: TaskRow, onUpdated?: () => void) => {

      if (task.category === "learning") {

        let gameId: GameId = "alphabet";

        if (task.description) {

          try {

            const parsed = JSON.parse(task.description);

            if (parsed?.gameId) {

              gameId = parsed.gameId as GameId;

            }

          } catch {

            // ignore

          }

        }

        tabNav.navigate("Activities", {

          screen: "GamePlay",

          params: { gameId, title: task.title, taskId: task.id },

        });

        return;

      }



      if (task.category === "exercise") {

        let exerciseId = normalizeExerciseId(undefined);

        if (task.description) {

          try {

            const parsed = JSON.parse(task.description);

            exerciseId = normalizeExerciseId(parsed?.exerciseId);

          } catch {

            // ignore

          }

        }

        tabNav.navigate("Activities", {

          screen: "ExerciseSession",

          params: { taskId: task.id, exerciseId, title: task.title },

        });

        return;

      }



      if (task.category === "chore" && task.requires_camera) {

        if (task.status === "submitted") {

          return;

        }

        void captureChorePhoto(task, onUpdated);

        return;

      }



      void completeTaskWithoutCamera(task, onUpdated);

    },

    [tabNav, captureChorePhoto, completeTaskWithoutCamera]

  );



  return {

    error,

    snackbar,

    setSnackbar,

    uploadingTaskId,

    pendingChorePhoto,

    onTaskPress,

    cancelChorePhotoReview,

    retakeChorePhoto,

    submitChorePhoto,

    completeTaskWithoutCamera,

    captureChorePhoto,

  };

}

