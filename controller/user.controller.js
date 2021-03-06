function userController(
    express, bodyParser, permissions, mailer, auth, users
) {
    'use strict';

    const router = express.Router();

    router.use(bodyParser.urlencoded({extended: true}));
    router.use(bodyParser.json());

    router.route('/')
        .get(
            auth.checkAuth,
            auth.checkInactiveToken,
            permissions.getRoleGuard([
                permissions.ROLES.EMPLOYEE,
                permissions.ROLES.SUPER_ADMIN
            ]),
            users.getList
        )
        .post(
            users.checkCreateForm,
            users.checkDuplicate,
            users.createUser,
            mailer.sendActivationLink
        );

    router.route('/:id/activate')
        .put(
            auth.checkAuth,
            auth.checkInactiveToken,
            permissions.getRoleGuard([
                permissions.ROLES.EMPLOYEE,
                permissions.ROLES.SUPER_ADMIN
            ]),
            users.getUser,
            users.checkBlacklist,
            users.isInactive,
            users.activate
        );

    router.route('/:id/deactivate')
        .put(auth.checkAuth,
            auth.checkInactiveToken,
            permissions.getRoleGuard([
                permissions.ROLES.USER,
                permissions.ROLES.EMPLOYEE,
                permissions.ROLES.SUPER_ADMIN
            ]),
            users.getUser,
            permissions.runIf([
                permissions.ROLES.USER
            ], users.checkPassword),
            permissions.runIf([
                permissions.ROLES.USER
            ], users.checkEmail),
            users.isActive,
            users.deactivate
        );

    router.route('/:id/account-info')
        .put(auth.checkAuth,
            auth.checkInactiveToken,
            permissions.getRoleGuard([
                permissions.ROLES.USER,
                permissions.ROLES.EMPLOYEE,
                permissions.ROLES.SUPER_ADMIN
            ]),
            users.getUser,
            permissions.runIf([
                permissions.ROLES.USER
            ], users.checkPassword),
            permissions.runIf([
                permissions.ROLES.USER
            ], users.checkEmail),
            users.updateUser,
            mailer.sendAccountInfoChangeNotification
        );

    router.route('/:id/info')
    .get(
        auth.checkAuth,
        auth.checkInactiveToken,
        permissions.getRoleGuard([
                permissions.ROLES.USER,
                permissions.ROLES.EMPLOYEE,
                permissions.ROLES.SUPER_ADMIN
        ]),
        permissions.getOwnerGuard(
                "id",
                permissions.ROLES.USER
        ),
        users.getUser,
        users.getUserInfo
    );

    router.route('/:id/password')
        .put(auth.checkAuth,
            auth.checkInactiveToken,
            permissions.getRoleGuard([
                permissions.ROLES.USER
            ]),
            users.getUser,
            permissions.runIf([
                permissions.ROLES.USER
            ], users.checkPassword),
            permissions.runIf([
                permissions.ROLES.USER
            ], users.checkEmail),
            auth.generateAuthToken,
            users.changePassword,
            auth.passwordChangeDeactivateToken,
            mailer.sendPasswordChangeNotification
        );

    return router;
}

module.exports = userController;
