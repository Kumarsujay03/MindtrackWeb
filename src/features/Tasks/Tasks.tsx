import { useEffect, useReducer, useRef, useState } from "react";
import Task from "./Task";
import { Input } from "../../components/ui/input";
import tasksReducer from "./tasksReducer";
import completionSound from "../../assets/completion.mp3";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  type DragStartEvent,
  DragOverlay,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Settings } from "../SettingsEditor/SettingsEditor";

export type CryptoUUID = `${string}-${string}-${string}-${string}-${string}`;
export type TaskType = {
  id: CryptoUUID;
  name: string;
  completed: boolean;
  active: boolean;
  currentlyEditing?: boolean;
};
type FocusedTaskState = {
  focusedTaskState: [
    TaskType | null,
    React.Dispatch<React.SetStateAction<TaskType | null>>
  ];
  settings: Settings;
};

const Tasks = ({ focusedTaskState, settings }: FocusedTaskState) => {
  const [tasks, dispatch] = useReducer(tasksReducer, []);
  const [inputValue, setInputValue] = useState("");
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const activeTask = tasks.find((task) => task.id === activeId);
  const [draftEdit, setDraftEdit] = useState("");

  let activeTaskPlaceholder;
  if (activeTask) {
    activeTaskPlaceholder = {
      ...activeTask,
      id: `${activeId}_copy` as CryptoUUID,
    };
  }

  const completionAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    dispatch({ type: "load" });
    completionAudioRef.current = new Audio(completionSound);
  }, []);

  const [, setFocusedTask] = focusedTaskState;

  useEffect(() => {
    const activeTask = tasks.find((task) => task.active) || null;

    setFocusedTask(activeTask);
  }, [tasks, setFocusedTask]);

  const handleNewTaskSubmission = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      dispatch({ type: "new", newTaskName: inputValue });
      setInputValue("");
    }
  };

  const handleTaskCompletion = (id: CryptoUUID) => {
    dispatch({ type: "complete", id: id, audioRef: completionAudioRef });
  };

  const handleTaskActivation = (id: CryptoUUID) => {
    dispatch({ type: "activate", id: id });
  };

  const handleDeleteTask = (id: CryptoUUID) => {
    dispatch({ type: "delete", id: id });
  };

  function handleDragEnd(event: DragEndEvent) {
    dispatch({ type: "sort", event: event });
    setActiveId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleModifyTask(id: CryptoUUID) {
    dispatch({ type: "modify", id: id, setDraftEdit: setDraftEdit });
  }

  function handleSaveEdit(id: CryptoUUID) {
    dispatch({ type: "save_edit", id: id, updatedTaskName: draftEdit });
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 10 pixels before activating
      activationConstraint: {
        distance: 0,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: {
        delay: 0,
        tolerance: 50,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <div className={`${!settings.taskSectionVisible && "hidden"}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
      >
        <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 w-full h-full mt-4">
            {tasks.map((task) => {
              return (
                <Task
                  key={task.id}
                  task={task}
                  activeTask={activeTask}
                  draftEdit={draftEdit}
                  setDraftEdit={setDraftEdit}
                  onComplete={handleTaskCompletion}
                  onActivate={handleTaskActivation}
                  onDelete={handleDeleteTask}
                  onModify={handleModifyTask}
                  onSaveEdit={handleSaveEdit}
                ></Task>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId && activeTaskPlaceholder ? (
            <Task
              key={activeTaskPlaceholder?.id}
              task={activeTaskPlaceholder}
              draftEdit={draftEdit}
              setDraftEdit={setDraftEdit}
              onComplete={handleTaskCompletion}
              onActivate={handleTaskActivation}
              onDelete={handleDeleteTask}
              onModify={handleModifyTask}
              onSaveEdit={handleSaveEdit}
            ></Task>
          ) : null}
        </DragOverlay>
      </DndContext>
      <Input
        id="newTaskInput"
        type="text"
        value={inputValue}
        placeholder="Add task name and hit enter..."
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleNewTaskSubmission}
        className="mt-2"
      />
    </div>
  );
};

export default Tasks;
