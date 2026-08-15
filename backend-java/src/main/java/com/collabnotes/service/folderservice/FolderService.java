package com.collabnotes.service.folderservice;

import com.collabnotes.model.Folder;
import com.collabnotes.repository.FolderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class FolderService {

    @Autowired
    private FolderRepository folderRepository;

    public List<Folder> getFoldersByOwner(String ownerId) {
        return folderRepository.findByOwnerId(ownerId);
    }

    // FIX: Added missing getFolderById used by FolderController for update/delete
    public Optional<Folder> getFolderById(String id) {
        return folderRepository.findById(id);
    }

    public Folder createFolder(Folder folder) {
        return folderRepository.save(folder);
    }

    public void deleteFolder(String folderId) {
        folderRepository.deleteById(folderId);
    }
}
