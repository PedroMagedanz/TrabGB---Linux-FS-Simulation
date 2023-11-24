// Importing the 'readline-sync' library for synchronous input/output operations
const readlineSync = require('readline-sync');

// An array to store file information
const fileStorage = [];

// Variables to manage user IDs and user data
let activeUserId = 0;
let nextUserId = 0;
const users = {};

// Class representing a user with a unique ID, username, and password
class User {
    constructor(username, password) {
        this.id = nextUserId;
        this.username = username;
        this.password = password;
        nextUserId++;
    }
}

// Class representing the structure of an Inode (Index Node) in a file system
class Inode {
    constructor(ownerId, fileType, size) {
        this.id = Inode.getNextId(); // Assign the next available ID
        this.ownerId = ownerId;
        this.fileType = fileType; // 'directory' for directories, 'file' for files
        this.size = size;
        this.creationTime = new Date();
        this.lastAccessTime = new Date();
        this.lastUpdateTime = new Date();

        // File permissions for user, group, and general
        this.permissions = {
            user: { read: true, write: true, execute: true },
            group: { read: true, write: false, execute: true },
            general: { read: true, write: false, execute: false },
        };

        // An array to store block addresses for data storage (10 block addresses)
        this.blockAddresses = Array.from({ length: 10 }, () => null);

        // Address for simple indirection
        this.indirectionAddress = null;

        // Object to store users associated with this Inode
        this.users = {};
    }

    // Function to retrieve Inode information
    getInfo() {
        return {
            id: this.id,
            ownerId: this.ownerId,
            fileType: this.fileType,
            size: this.size,
            creationTime: this.creationTime,
            lastAccessTime: this.lastAccessTime,
            lastUpdateTime: this.lastUpdateTime,
            permissions: this.permissions,
        };
    }

    // Function to associate a user with this Inode
    addUser(user) {
        this.user = user;
    }

    // Static function to generate the next available Inode ID
    static getNextId() {
        return Inode.nextId++;
    }

    // Function to check if a user has write permission for this Inode
    hasWritePermission(userId) {
        if (this.permissions.general.write) {
            // If general write permission is true, everyone can write
            return true;
        } else {
            // Otherwise, only the owner can write
            return userId === this.ownerId;
        }
    }

    // Function to change the owner of the Inode
    changeOwner(userId) {
        this.ownerId = userId;
    }
}

// Setting the initial value for the next available Inode ID
Inode.nextId = 0;

// Class representing a File with a name and associated Inode
class File {
    constructor(name, inode) {
        this.name = name;
        this.inode = inode;
    }
}

// Class defining the structure of a directory with a name and associated Inode
class Directory {
    constructor(name, inode) {
        this.name = name;
        this.inode = inode;
        this.files = {};
        this.subdirectories = {};
    }

    // Function to add a file to the directory
    addFile(file) {
        this.files[file.name] = file;
    }

    // Function to add a subdirectory to the directory
    addSubdirectory(subdirectory) {
        this.subdirectories[subdirectory.name] = subdirectory;
    }
}

// Class representing the content of a file with a name and optional content
class FileContent {
    constructor(name, content = '') {
        this.name = name;
        this.content = content;
    }
}

// Function to create the disk and initialize the file system
function createDisk() {
    let sizeInBytes = 0;
    console.log("--- Creating Disk ---");

    // User input to determine the disk size
    do {
        sizeInBytes = readlineSync.question('Enter the disk size in bytes (between 512 and 33554432, press Enter to use the maximum size - 33554432 bytes): ');

        // If the user doesn't enter anything, consider the maximum available size
        sizeInBytes = sizeInBytes.trim() === '' ? 33554432 : parseInt(sizeInBytes, 10);

        // Validate the entered disk size
        if (sizeInBytes < 512 || sizeInBytes > 33554432) {
            console.log('Error: Disk size must be between 512 and 33554432 bytes. Please try again.');
        }

    } while (sizeInBytes < 512 || sizeInBytes > 33554432);

    // Calculate the number of 512-byte blocks
    const numberOfBlocks = Math.floor(sizeInBytes / 512);

    // Simulate the disk as an array of empty blocks
    const disk = Array.from({ length: numberOfBlocks }, () => Buffer.alloc(512));

    // Allocate initial space for the root directory
    const rootInode = new Inode(0, 'directory', 512);
    const rootDirectory = new Directory('/', rootInode);
    allocateBlockOnDisk(disk, rootDirectory);

    // Prompt the user for the admin password
    const adminPassword = readlineSync.question('Enter the password for the admin user (press Enter for default password "1234"): ', { hideEchoBack: true });

    // Set default password if the input is blank
    const adminDefaultPassword = '1234';
    const adminUser = new User('admin', adminPassword.trim() === '' ? adminDefaultPassword : adminPassword);

    // Set the initial user ID for the admin user
    adminUser.id = 0;

    // Add admin user to the user database
    users[adminUser.id] = adminUser;

    // Add admin user to the root Inode
    rootInode.addUser(adminUser);

    // Return the created disk and root directory
    return { disk, rootDirectory };
}

// Function to add a new user to the system
function addUser() {
    // Check if the active user is the admin (userID 0)
    if (activeUserId !== 0) {
        console.log('Error: Only the admin user can add new users.');
        return;
    }

    // Prompt for new user information
    const newUsername = readlineSync.question('Enter the new user name: ');
    const newPassword = readlineSync.question('Enter the password for the new user: ', { hideEchoBack: true });

    // Create a new user object and add it to the user database
    const newUser = new User(newUsername, newPassword);
    users[newUser.id] = newUser;

    console.log(`User "${newUsername}" created successfully with ID ${newUser.id}.`);
}

// Function to allocate a block on the disk for a given object
function allocateBlockOnDisk(disk, object) {
    for (let i = 0; i < disk.length; i++) {
        if (disk[i].every((byte) => byte === 0)) {
            // If the block is empty, allocate the object in the block
            disk[i] = Buffer.from(JSON.stringify(object));
            break;
        }
    }
}

// Function to remove a user from the system
function removeUser() {
    console.log('\n--- Remove User ---');
    listUsers();

    // Prompt for the user ID to be removed
    const userIdToRemove = parseInt(readlineSync.question('Enter the ID of the user to be removed: '), 10);

    // Check conditions for user removal
    if (userIdToRemove === 0) {
        console.log('Error: Cannot remove the admin user.');
    } else if (userIdToRemove === activeUserId) {
        console.log('Error: You cannot remove the currently active user.');
    } else if (users[userIdToRemove]) {
        // Remove the user from the user database
        delete users[userIdToRemove];
        console.log(`User with ID ${userIdToRemove} removed successfully.`);
    } else {
        console.log(`Error: User with ID ${userIdToRemove} not found.`);
    }
}

// Function to list users with both name and ID
function listUsers() {
    console.log('\n--- User List ---');
    for (const userId in users) {
        const user = users[userId];
        console.log(`ID: ${user.id}, Name: ${user.username}`);
    }
}

// Function to display disk information
function displayDiskInfo(disk) {
    // Calculate disk statistics
    const availableBytes = disk.filter((block) => block.every((byte) => byte === 0)).length * 512;
    const availableBlocks = disk.filter((block) => block.every((byte) => byte === 0)).length;
    const diskSize = disk.length * 512;
    const usedBlocks = disk.filter((block) => !block.every((byte) => byte === 0)).length;

    // Display disk information
    console.log("\n");
    console.log(`Total Bytes: ${diskSize} bytes`);
    console.log(`Available Bytes: ${availableBytes}`);
    console.log(`Total Blocks: ${availableBlocks}`);
    console.log(`Used Blocks: ${usedBlocks}`);
}

// Function to reset the root directory
function resetRoot(rootDirectory) {
    // Clear subdirectories and files in the root directory
    rootDirectory.subdirectories = {};
    rootDirectory.files = {};
}

// Function to switch the active user
function switchUser() {
    console.log('\n--- Switch User ---');
    listUsers();

    // Prompt for the ID of the user to switch to
    const newUserId = parseInt(readlineSync.question('Enter the ID of the user to switch to: '), 10);

    // Check if the user exists
    if (users[newUserId]) {
        // Prompt for the password
        const enteredPassword = readlineSync.question('Enter the password: ', { hideEchoBack: true });

        // Check if the entered password is correct
        if (enteredPassword === users[newUserId].password) {
            // Switch to the new user
            activeUserId = newUserId;
            console.log(`Switched to user "${users[activeUserId].username}" with ID ${activeUserId}.`);
        } else {
            console.log('Error: Incorrect password. User switch failed.');
        }
    } else {
        console.log(`Error: User with ID ${newUserId} not found.`);
    }
}

// Main loop
function mainLoop() {
    let { disk, rootDirectory } = createDisk();

    while (true) {

        console.log('\n--- Available Commands ---');
        console.log(' "ls" - List directories          "shutdown" - Exit');
        console.log(' "mkdir" - Create directory       "rmdir" - Remove directory');
        console.log(' "touch" - Create file            "su" - Switch user');
        console.log(' "adduser" - Add user             "rmuser" - Remove user');
        console.log(' "lsuser" - List users            "ls -i" - List Inode of a directory');
        console.log(' "mkfs" - Reset root directory    "df" - Display disk information');
        console.log(' "rm" - Delete file               "chmod" - Change permissions');
        console.log(' "echo" - Write to file           "cat" - Read file');
        console.log(' "cd" - List directory content    "chown" - Change file/directory ownership');
        console.log('\n');

        const option = readlineSync.question(`Enter the desired command (Current User: ${users[activeUserId].username}@${activeUserId}): `);

        switch (option) {
            case 'ls':
                console.log('\n--- Directory Listing ---');
                console.log('\n--- Type - Name - InodeID ---');
                listSubdirectories(rootDirectory, '');
                break;

            case 'df':
                console.log('\n--- Disk Information ---');
                displayDiskInfo(disk);
                break;

            case 'mkdir':
                const newDirectoryName = readlineSync.question('Enter the name of the new directory: ');
                const newDirectoryInode = new Inode(activeUserId, 'directory', 128); // Set ownerId to activeUserId
                const newDirectory = new Directory(newDirectoryName, newDirectoryInode);
                rootDirectory.addSubdirectory(newDirectory);
                allocateBlockOnDisk(disk, newDirectory);
                console.log(`Directory "${newDirectoryName}" created successfully.`);
                break;

            case 'rmdir':
                const directoryToRemove = readlineSync.question('Enter the name of the directory to be removed: ');

                if (directoryToRemove === '/') {
                    console.log('Error: Cannot remove the root directory.');
                } else if (rootDirectory.subdirectories[directoryToRemove]) {
                    const targetDirectory = rootDirectory.subdirectories[directoryToRemove];

                    // Check if the active user has general write permission to remove the directory
                    const hasGeneralWritePermission = targetDirectory.inode.permissions.general.write;

                    if (activeUserId === 0 || hasGeneralWritePermission) {
                        // Remove the directory from rootDirectory
                        delete rootDirectory.subdirectories[directoryToRemove];
                        console.log(`Directory "${directoryToRemove}" removed successfully.`);
                    } else {
                        console.log('Error: You do not have permission to remove this directory.');
                    }
                } else {
                    console.log(`Error: Directory "${directoryToRemove}" not found or is not a directory.`);
                }
                break;

            case 'touch':
                const fileName = readlineSync.question('Enter the name of the file: ');
                let fileSize = parseInt(readlineSync.question('Enter the file size in bytes: '), 10);

                // Round up to ensure allocation of whole blocks
                const numBlocks = Math.ceil(fileSize / 512);
                fileSize = numBlocks * 512;

                // Check if there is enough space on the disk
                const requiredSpace = numBlocks * 512;
                const availableSpace = disk.filter((block) => block.every((byte) => byte === 0)).length * 512;

                if (requiredSpace > availableSpace) {
                    console.log('Error: Not enough space on the disk to create the file.');
                    break;
                }

                const fileInode = new Inode(activeUserId, 'file', fileSize); // Set ownerId to activeUserId
                const newFile = new File(fileName, fileInode);

                console.log('\n--- Choose a directory to insert the file ---');
                console.log('Available directories:');
                Object.keys(rootDirectory.subdirectories).forEach((subdir) => {
                    console.log(subdir);
                });

                const chosenDirectory = readlineSync.question('Enter the name of the directory: ');

                if (rootDirectory.subdirectories[chosenDirectory]) {
                    rootDirectory.subdirectories[chosenDirectory].addFile(newFile);
                    // Allocate blocks on the disk
                    for (let i = 0; i < numBlocks; i++) {
                        allocateBlockOnDisk(disk, newFile);
                    }
                    console.log(`File "${fileName}" inserted successfully into the directory "${chosenDirectory}".`);
                } else {
                    console.log(`Error: Directory "${chosenDirectory}" not found or tried to write to root. `);
                }
                break;

            case 'adduser':
                addUser();
                break;

            case 'rmuser':
                removeUser();
                break;

            case 'lsuser':
                listUsers();
                break;

            case 'ls -i':
                const directoryToInspect = readlineSync.question('Enter the name of the directory or file to list the Inode: ');
                listInodeOfDirectory(rootDirectory, directoryToInspect);
                break;

            case 'mkfs':
                const confirmReset = readlineSync.keyInYNStrict('Are you sure you want to reset the root directory?');

                if (confirmReset) {
                    resetRoot(rootDirectory);
                    console.log('Root directory reset successfully.');
                } else {
                    console.log('Root directory reset canceled.');
                }
                break;

            case 'su':
                switchUser();
                break;

            case 'rm':
                const targetDirectoryName = readlineSync.question('Enter the name of the directory containing the file to be removed: ');

                if (rootDirectory.subdirectories[targetDirectoryName]) {
                    const fileToRemove = readlineSync.question('Enter the name of the file to be removed: ');

                    const targetDirectory = rootDirectory.subdirectories[targetDirectoryName];

                    if (targetDirectory.files[fileToRemove]) {
                        delete targetDirectory.files[fileToRemove];
                        console.log(`File "${fileToRemove}" removed successfully from directory "${targetDirectoryName}".`);
                    } else {
                        console.log(`Error: File "${fileToRemove}" not found in directory "${targetDirectoryName}".`);
                    }
                } else {
                    console.log(`Error: Directory "${targetDirectoryName}" not found.`);
                }
                break;

            case 'chmod':
                const directoryToSearch = readlineSync.question('Enter the name of the directory to search for: ');

                const targetDirectoryToChangePermissions = findDirectory(rootDirectory, directoryToSearch);

                if (targetDirectoryToChangePermissions) {
                    const enteredPasswordForPermissionChange = readlineSync.question('Enter the password for permission change: ', { hideEchoBack: true });

                    if (activeUserId === 0 || (enteredPasswordForPermissionChange === users[activeUserId].password && targetDirectoryToChangePermissions.inode.ownerId === activeUserId)) {
                        const permissionGroup = readlineSync.question('Enter the permission group to change (user, group, or general): ');

                        if (['user', 'group', 'general'].includes(permissionGroup)) {
                            const newPermission = readlineSync.question(`Enter the new permissions for ${permissionGroup} (e.g., rwx): `);

                            if (validatePermissionInput(newPermission)) {
                                // Update the specified permission group of the directory's inode
                                targetDirectoryToChangePermissions.inode.permissions[permissionGroup].read = newPermission.includes('r');
                                targetDirectoryToChangePermissions.inode.permissions[permissionGroup].write = newPermission.includes('w');
                                targetDirectoryToChangePermissions.inode.permissions[permissionGroup].execute = newPermission.includes('x');

                                console.log(`Permissions for ${permissionGroup} of directory "${directoryToSearch}" changed successfully.`);
                            } else {
                                console.log('Error: Invalid permission format. Please use "r", "w", and "x".');
                            }
                        } else {
                            console.log('Error: Invalid permission group. Please enter "user", "group", or "general".');
                        }
                    } else {
                        console.log('Error: Incorrect password or insufficient permissions. Permission change failed.');
                    }
                } else {
                    console.log(`Error: Directory "${directoryToSearch}" not found.`);
                }
                break;

            case 'echo':
                const itemToSearch = readlineSync.question('Enter the name of the file to write to: ');

                const targetItem = findDirectory(rootDirectory, itemToSearch);

                if (targetItem && targetItem.inode.fileType === 'file') {

                    // Check if the active user has write permission
                    if (targetItem.inode.hasWritePermission(activeUserId)) {
                        // Ask the user to write content
                        const newContent = readlineSync.question('Enter the content to write to the file: ');

                        // Update the content of the existing file
                        targetItem.inode.size = Buffer.from(newContent).length;

                        // Store the filename and content in an external array
                        const fileData = {
                            fileName: itemToSearch,
                            content: newContent,
                        };

                        // Add fileData to an external array or process it as needed
                        fileStorage.push(fileData);

                        console.log(`Content updated for file "${itemToSearch}".`);
                    } else {
                        console.log('Error: You do not have write permission for this file.');
                    }
                } else {
                    console.log(`Error: File "${itemToSearch}" not found or is not a file.`);
                }
                break;

            case 'cat':
                const fileNameToSearch = readlineSync.question('Enter the name of the file to read: ');

                const foundFile = fileStorage.find(file => file.fileName === fileNameToSearch);

                if (foundFile) {

                    // Check if the active user is the owner or has general read permission
                    const targetItem = findDirectory(rootDirectory, fileNameToSearch);
                    if (targetItem) {
                        const isOwner = targetItem.inode.ownerId === activeUserId;
                        const hasGeneralReadPermission = targetItem.inode.permissions.general.read;

                        if (isOwner || hasGeneralReadPermission) {
                            console.log('--- Content ---');
                            console.log(foundFile.content);
                            console.log('---');
                        } else {
                            console.log('Error: You do not have read permission for this file.');
                        }
                    } else {
                        console.log(`Error: File "${fileNameToSearch}" not found.`);
                    }
                } else {
                    console.log(`Error: File "${fileNameToSearch}" not found.`);
                }
                break;

            case 'cd':
                const directoryToList = readlineSync.question('Enter the name of the directory to list contents: ');

                const targetDirectoryToList = findDirectory(rootDirectory, directoryToList); // Use 'directoryToList' instead of 'directoryToSearch'

                if (targetDirectoryToList) {
                    console.log(`\n--- Contents of Directory "${directoryToList}" ---`);

                    // Display the current directory
                    console.log(`D - ${targetDirectoryToList.name} (inode: ${targetDirectoryToList.inode.id})`);

                    // Display subdirectories
                    for (const subdirectoryName in targetDirectoryToList.subdirectories) {
                        const subdirectory = targetDirectoryToList.subdirectories[subdirectoryName];
                        console.log(`|   D - ${subdirectory.name} (inode: ${subdirectory.inode.id})`);
                    }

                    // Display files
                    for (const fileName in targetDirectoryToList.files) {
                        const file = targetDirectoryToList.files[fileName];
                        console.log(`|   F - ${file.name} (inode: ${file.inode.id})`);
                    }
                } else {
                    console.log(`Error: Directory "${directoryToList}" not found.`);
                }
                break;

            case 'chown':
                const itemToSearch2 = readlineSync.question('Enter the name of the file/directory to change ownership: ');

                const targetItem2 = findDirectory(rootDirectory, itemToSearch2);

                if (targetItem2) {
                    const newUserId = parseInt(readlineSync.question('Enter the new userId for the file/directory: '), 10);

                    // Check if the active user has permission to change the userId
                    if (activeUserId === 0 || activeUserId === targetItem2.inode.ownerId) {
                        targetItem2.inode.changeOwner(newUserId);
                        console.log(`UserId for "${itemToSearch2}" changed to ${newUserId}.`);
                    } else {
                        console.log('Error: You do not have permission to change the userId for this file/directory.');
                    }
                } else {
                    console.log(`Error: File or directory "${itemToSearch2}" not found.`);
                }
                break;

            case 'shutdown':
                console.log('Shutting down system.');
                process.exit(0);

            default:
                console.log('Invalid command. Please use a supported command.');
        }
    }
}

// Start the main loop
mainLoop();

// Function to list subdirectories and files with indentation
function listSubdirectories(directory, indent = '', isFile = false) {
    // Display the current directory or file
    if (directory instanceof Directory) {
        console.log(`${indent}D - ${directory.name} - (inode: ${directory.inode.id})`);
    } else if (directory instanceof File) {
        console.log(`${indent}|-- F - ${directory.name} - (inode: ${directory.inode.id})`);
    }

    // Display subdirectories
    for (const subdirectoryName in directory.subdirectories) {
        const subdirectory = directory.subdirectories[subdirectoryName];
        listSubdirectories(subdirectory, `${indent}|   `);
    }

    // Display files
    for (const fileName in directory.files) {
        const file = directory.files[fileName];
        listSubdirectories(file, `${indent}|   `, true);
    }
}

// Function to list Inode information of a directory or file
function listInodeOfDirectory(directory, targetDirectory) {
    const target = findDirectory(directory, targetDirectory);

    if (target) {
        // Display Inode information of the target directory or file
        const inodeInfo = target.inode.getInfo();
        console.log('\n--- Inode Information of Directory or File ---');
        console.log(inodeInfo);

        if (target.fileType === 'directory') {
            // Display Inode information of files in the directory
            const files = Object.values(target.files || {});
            if (files.length > 0) {
                console.log('\n--- Files in the Directory ---');
                files.forEach((file) => {
                    const fileInodeInfo = file.inode.getInfo();
                    console.log(`File: ${file.name}`);
                    console.log(fileInodeInfo);
                    console.log('---');
                });
            }

            // Display Inode information of subdirectories in the directory
            const subdirectories = Object.values(target.subdirectories || {});
            if (subdirectories.length > 0) {
                console.log('\n--- Subdirectories in the Directory ---');
                subdirectories.forEach((subdirectory) => {
                    const subdirectoryInodeInfo = subdirectory.inode.getInfo();
                    console.log(`Subdirectory: ${subdirectory.name}`);
                    console.log(subdirectoryInodeInfo);
                    console.log('---');
                });
            }
        }
    } else {
        console.log(`Error: Directory or File "${targetDirectory}" not found.`);
    }
}

// Function to find a directory or file in the file system
function findDirectory(directory, targetDirectory) {
    if (directory.name === targetDirectory) {
        return directory;
    }

    // Check if targetDirectory is the name of a file in the directory
    if (directory.files[targetDirectory]) {
        return directory.files[targetDirectory];
    }

    // Recursively search subdirectories
    for (const subdirectoryName in directory.subdirectories) {
        const subdirectory = directory.subdirectories[subdirectoryName];
        const result = findDirectory(subdirectory, targetDirectory);
        if (result) {
            return result;
        }
    }

    return null;
}

// Function to validate permission input format
function validatePermissionInput(permission) {
    const validChars = ['r', 'w', 'x'];

    // Check if each character in the input is a valid permission character
    for (const char of permission) {
        if (!validChars.includes(char)) {
            return false;
        }
    }

    return true;
}
