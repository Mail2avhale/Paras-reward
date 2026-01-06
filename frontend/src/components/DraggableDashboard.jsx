import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings2, Check, RotateCcw, X, Lock } from 'lucide-react';
import { Button } from './ui/button';

// Sortable Card Wrapper Component
const SortableCard = ({ id, children, isEditMode, isLocked }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode || isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isEditMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={`absolute -left-2 top-1/2 -translate-y-1/2 z-10 ${
            isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
          }`}
          {...(isLocked ? {} : { ...attributes, ...listeners })}
        >
          <div className={`p-2 rounded-lg shadow-lg ${
            isLocked 
              ? 'bg-gray-400' 
              : 'bg-purple-600 hover:bg-purple-700'
          }`}>
            {isLocked ? (
              <Lock className="w-4 h-4 text-white" />
            ) : (
              <GripVertical className="w-4 h-4 text-white" />
            )}
          </div>
        </motion.div>
      )}
      <div className={`transition-all duration-200 ${
        isEditMode ? 'ml-6 ring-2 ring-purple-200 ring-offset-2 rounded-2xl' : ''
      }`}>
        {children}
      </div>
    </div>
  );
};

// Main Draggable Dashboard Container
const DraggableDashboard = ({ 
  children, 
  cardIds, 
  onOrderChange,
  lockedCards = [], // Cards that cannot be moved
  translations = {}
}) => {
  const [items, setItems] = useState(cardIds);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Update items when cardIds prop changes
  useEffect(() => {
    setItems(cardIds);
  }, [cardIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        return newOrder;
      });
    }
  };

  const handleSave = () => {
    onOrderChange(items);
    setIsEditMode(false);
    setHasChanges(false);
  };

  const handleReset = () => {
    setItems(cardIds);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setItems(cardIds);
    setIsEditMode(false);
    setHasChanges(false);
  };

  const t = (key) => translations[key] || key;

  // Create a map of children by their card ID
  const childrenMap = {};
  React.Children.forEach(children, (child) => {
    if (child && child.props && child.props.cardId) {
      childrenMap[child.props.cardId] = child;
    }
  });

  return (
    <div className="relative">
      {/* Edit Mode Toggle Button - Always visible when not in edit mode */}
      {!isEditMode && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsEditMode(true)}
          className="fixed bottom-28 right-4 z-50 bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all"
          data-testid="edit-dashboard-btn"
          title={t('customizeDashboard')}
        >
          <Settings2 className="w-6 h-6" />
        </motion.button>
      )}

      {/* Edit Mode Control Panel */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-20 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 border-2 border-purple-200"
            data-testid="edit-mode-panel"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{t('customizeDashboard')}</h3>
                <p className="text-sm text-gray-500">{t('dragToReorder')}</p>
              </div>
              <button 
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges}
                className={`flex-1 ${hasChanges ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-300'} text-white`}
                data-testid="save-layout-btn"
              >
                <Check className="w-4 h-4 mr-2" />
                {t('saveLayout')}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1 border-purple-300"
                data-testid="reset-layout-btn"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t('resetLayout')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Mode Indicator */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4 rounded-xl mb-4 text-center text-sm font-medium"
          >
            <GripVertical className="w-4 h-4 inline-block mr-2" />
            {t('dragToReorder')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Content */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {items.map((id) => (
              <SortableCard 
                key={id} 
                id={id} 
                isEditMode={isEditMode}
                isLocked={lockedCards.includes(id)}
              >
                {childrenMap[id] || null}
              </SortableCard>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-80 transform scale-105">
              {childrenMap[activeId] || null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

// Wrapper component for dashboard cards
export const DashboardCard = ({ cardId, children, className = '' }) => {
  return (
    <div className={className} data-card-id={cardId}>
      {children}
    </div>
  );
};

export default DraggableDashboard;
