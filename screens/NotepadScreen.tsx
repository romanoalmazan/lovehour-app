import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getUserData, verifyMutualMatch } from '../services/userService';
import {
  subscribeToSharedNotes,
  updateSharedNote,
  createSharedNote,
  deleteSharedNote,
  SharedNote,
} from '../services/notesService';

const NotepadScreen: React.FC = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get partner ID and set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const setupNotes = async () => {
      try {
        setLoading(true);
        const verification = await verifyMutualMatch(user.uid);

        if (verification.isValid && verification.partnerData) {
          const userData = await getUserData(user.uid);
          if (userData?.matchedWith) {
            setPartnerId(userData.matchedWith);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error setting up notes:', error);
        setLoading(false);
      }
    };

    setupNotes();
  }, [user]);

  // Subscribe to real-time notes updates
  useEffect(() => {
    if (!user || !partnerId) return;

    const unsubscribe = subscribeToSharedNotes(
      user.uid,
      partnerId,
      (updatedNotes) => {
        setNotes(updatedNotes);

        // If no note is selected and notes exist, select the first one
        if (!selectedNoteId && updatedNotes.length > 0) {
          setSelectedNoteId(updatedNotes[0].id);
          setLocalContent(updatedNotes[0].content);
        } else if (selectedNoteId) {
          // Update local content if selected note still exists
          const selectedNote = updatedNotes.find(
            (note) => note.id === selectedNoteId
          );
          if (selectedNote) {
            // Only update if not actively typing (saveTimeoutRef is null)
            if (saveTimeoutRef.current === null) {
              setLocalContent(selectedNote.content);
            }
          } else {
            // Selected note was deleted, select first available or null
            if (updatedNotes.length > 0) {
              setSelectedNoteId(updatedNotes[0].id);
              setLocalContent(updatedNotes[0].content);
            } else {
              setSelectedNoteId(null);
              setLocalContent('');
            }
          }
        }

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, partnerId, selectedNoteId]);

  // Update local content when selected note changes
  useEffect(() => {
    if (selectedNoteId) {
      const selectedNote = notes.find((note) => note.id === selectedNoteId);
      if (selectedNote) {
        setLocalContent(selectedNote.content);
      }
    } else {
      setLocalContent('');
    }
  }, [selectedNoteId, notes]);

  // Auto-save with debouncing
  const handleContentChange = useCallback(
    (text: string) => {
      setLocalContent(text);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save (1.5 seconds after typing stops)
      saveTimeoutRef.current = setTimeout(async () => {
        if (!user || !partnerId || !selectedNoteId) return;

        setSaving(true);
        const result = await updateSharedNote(
          user.uid,
          partnerId,
          selectedNoteId,
          { content: text },
          user.uid
        );

        if (!result.success) {
          console.error('Error saving note:', result.error);
          Alert.alert('Error', result.error || 'Failed to save note');
        }

        setSaving(false);
        saveTimeoutRef.current = null;
      }, 1500);
    },
    [user, partnerId, selectedNoteId]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleCreateNote = async () => {
    if (!user || !partnerId) return;

    const trimmedTitle = newNoteTitle.trim();
    if (!trimmedTitle) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    if (trimmedTitle.length > 50) {
      Alert.alert('Error', 'Note title must be 50 characters or less');
      return;
    }

    if (notes.length >= 10) {
      Alert.alert('Error', 'Maximum of 10 notes allowed');
      return;
    }

    setSaving(true);
    const result = await createSharedNote(
      user.uid,
      partnerId,
      trimmedTitle,
      '',
      user.uid
    );

    if (result.success && result.noteId) {
      setSelectedNoteId(result.noteId);
      setNewNoteTitle('');
      setShowCreateModal(false);
    } else {
      Alert.alert('Error', result.error || 'Failed to create note');
    }

    setSaving(false);
  };

  const handleDeleteNote = () => {
    if (!selectedNoteId) return;

    const selectedNote = notes.find((note) => note.id === selectedNoteId);
    if (!selectedNote) return;

    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${selectedNote.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user || !partnerId) return;

            setSaving(true);
            const result = await deleteSharedNote(
              user.uid,
              partnerId,
              selectedNoteId
            );

            if (result.success) {
              // Note will be removed from list via real-time subscription
              // Selected note will be updated automatically
            } else {
              Alert.alert('Error', result.error || 'Failed to delete note');
            }

            setSaving(false);
          },
        },
      ]
    );
  };

  const handleSelectNote = async (noteId: string) => {
    // Save current note before switching
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // If there's unsaved content, save it first
    if (selectedNoteId && localContent !== undefined && user && partnerId) {
      const currentNote = notes.find((note) => note.id === selectedNoteId);
      if (currentNote && localContent !== currentNote.content) {
        await updateSharedNote(
          user.uid,
          partnerId,
          selectedNoteId,
          { content: localContent },
          user.uid
        );
      }
    }

    setSelectedNoteId(noteId);
    setShowDropdown(false);
  };

  const selectedNote = notes.find((note) => note.id === selectedNoteId);
  const noteCount = notes.length;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#D4A574" />
        <Text style={styles.loadingText}>Loading notes...</Text>
      </View>
    );
  }

  if (!partnerId) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          You need to be matched with a partner to use shared notes.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Shared Notes</Text>
          <Text style={styles.noteCount}>{noteCount}/10 notes</Text>
        </View>

        <View style={styles.controlsContainer}>
          {/* Note Selector Dropdown */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowDropdown(!showDropdown)}
              disabled={notes.length === 0}
            >
              <Text style={styles.dropdownButtonText} numberOfLines={1}>
                {selectedNote
                  ? selectedNote.title
                  : notes.length === 0
                  ? 'No notes'
                  : 'Select a note'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            {showDropdown && notes.length > 0 && (
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScrollView}>
                  {notes.map((note) => (
                    <TouchableOpacity
                      key={note.id}
                      style={[
                        styles.dropdownItem,
                        selectedNoteId === note.id && styles.dropdownItemSelected,
                      ]}
                      onPress={() => handleSelectNote(note.id)}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedNoteId === note.id &&
                            styles.dropdownItemTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {note.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.createButton]}
              onPress={() => setShowCreateModal(true)}
              disabled={notes.length >= 10 || saving}
            >
              <Text style={styles.actionButtonText}>+ New</Text>
            </TouchableOpacity>

            {selectedNoteId && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDeleteNote}
                disabled={saving}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#D4A574" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}

        {/* Note Content */}
        {selectedNote ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={localContent}
              onChangeText={handleContentChange}
              placeholder="Start typing your note here..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              No notes yet. Create your first note to get started!
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Create Note Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          setNewNoteTitle('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowCreateModal(false);
            setNewNoteTitle('');
          }}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Create New Note</Text>
            <TextInput
              style={styles.modalInput}
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
              placeholder="Enter note title..."
              placeholderTextColor="#999"
              maxLength={50}
              autoFocus
            />
            <Text style={styles.modalHint}>
              {newNoteTitle.length}/50 characters
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewNoteTitle('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCreate]}
                onPress={handleCreateNote}
                disabled={saving || !newNoteTitle.trim()}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonText,
                      styles.modalButtonTextCreate,
                    ]}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6d5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8B6F47',
    letterSpacing: 1,
  },
  noteCount: {
    fontSize: 14,
    color: '#8B6F47',
    fontWeight: '600',
  },
  controlsContainer: {
    marginBottom: 20,
    gap: 12,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4A574',
    padding: 16,
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#8B6F47',
    marginLeft: 8,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4A574',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#ffe6d5',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#8B6F47',
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  createButton: {
    backgroundColor: '#D4A574',
    borderColor: '#8B6F47',
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderColor: '#dc3545',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc3545',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savingText: {
    fontSize: 14,
    color: '#8B6F47',
    fontWeight: '600',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4A574',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 400,
  },
  textInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    minHeight: 400,
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4A574',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8B6F47',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8B6F47',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8B6F47',
    textAlign: 'center',
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffe6d5',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#D4A574',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B6F47',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4A574',
    padding: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: '#8B6F47',
    textAlign: 'right',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  modalButtonCancel: {
    backgroundColor: '#fff',
    borderColor: '#8B6F47',
  },
  modalButtonCreate: {
    backgroundColor: '#D4A574',
    borderColor: '#8B6F47',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B6F47',
  },
  modalButtonTextCreate: {
    color: '#fff',
  },
});

export default NotepadScreen;
